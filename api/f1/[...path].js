const BASE_URL = 'https://api.openf1.org/v1';
const cache = globalThis.__openF1Cache ?? new Map();
globalThis.__openF1Cache = cache;

async function openF1(endpoint, ttlMs = 10 * 60 * 1000) {
  const key = `${BASE_URL}${endpoint}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const response = await fetch(key);
  if (!response.ok) {
    throw new Error(`OpenF1 ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  return data;
}

const safe = (promise, fallback) => promise.catch(() => fallback);
const numbers = (values) => values.filter((value) => Number.isFinite(value));
const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const bestLap = (laps) => {
  const values = numbers(laps.map((lap) => lap.lap_duration));
  return values.length ? Math.min(...values) : null;
};
const avgLap = (laps) => average(numbers(laps.filter((lap) => !lap.is_pit_out_lap).map((lap) => lap.lap_duration)));
const pitDuration = (pit) => pit.stop_duration ?? pit.lane_duration ?? null;

function analyzeDriverIssues(driverNumber, raceControl, result, pits, laps, positions) {
  const issueWords = ['investigation', 'penalty', 'noted', 'causing a collision', 'track limits', 'unsafe release', 'false start', 'impeding'];
  const issues = [];

  raceControl
    .filter((event) => event.driver_number === driverNumber && issueWords.some((word) => String(event.message).toLowerCase().includes(word)))
    .forEach((event) => issues.push({
      driver_number: driverNumber,
      type: String(event.message).toLowerCase().includes('penalty') ? 'penalty' : 'incident',
      severity: 'medium',
      lap_number: event.lap_number ?? undefined,
      message: `Race Control отметил событие${event.lap_number ? ` на ${event.lap_number} круге` : ''}: ${event.message}`,
      source: 'race_control'
    }));

  if (result?.dnf) issues.push({ driver_number: driverNumber, type: 'dnf', severity: 'high', message: 'Пилот не финишировал — возможный проблемный момент гонки.', source: 'calculated' });
  if (result?.dns) issues.push({ driver_number: driverNumber, type: 'dns', severity: 'high', message: 'Пилот не стартовал.', source: 'calculated' });
  if (result?.dsq) issues.push({ driver_number: driverNumber, type: 'dsq', severity: 'high', message: 'Пилот был дисквалифицирован.', source: 'calculated' });

  const firstPosition = positions.find((position) => position.driver_number === driverNumber)?.position;
  if (firstPosition && result?.position && firstPosition - result.position <= -5) {
    issues.push({ driver_number: driverNumber, type: 'position_loss', severity: 'medium', message: `По данным видно: пилот потерял ${result.position - firstPosition} позиций относительно ранней позиции.`, source: 'calculated' });
  }

  const pitAverage = average(numbers(pits.map(pitDuration)));
  pits.filter((pit) => pit.driver_number === driverNumber).forEach((pit) => {
    const duration = pitDuration(pit);
    if (duration && pitAverage && duration > pitAverage * 1.25) {
      issues.push({ driver_number: driverNumber, type: 'slow_pit', severity: 'medium', lap_number: pit.lap_number, message: `Пит-стоп на ${pit.lap_number} круге был заметно медленнее среднего.`, source: 'calculated' });
    }
  });

  const driverLaps = laps.filter((lap) => lap.driver_number === driverNumber && !lap.is_pit_out_lap && lap.lap_duration);
  const driverAverage = average(driverLaps.map((lap) => lap.lap_duration));
  driverLaps.slice(0, 120).forEach((lap) => {
    if (driverAverage && lap.lap_duration > driverAverage * 1.2) {
      issues.push({ driver_number: driverNumber, type: 'bad_lap', severity: 'low', lap_number: lap.lap_number, message: `На ${lap.lap_number} круге темп был значительно хуже среднего.`, source: 'calculated' });
    }
  });

  return issues.slice(0, 12);
}

async function buildRaceBundle(sessionKey) {
  const [drivers, results, laps, pits, stints, positions, raceControl, weather, overtakes, locations] = await Promise.all([
    safe(openF1(`/drivers?session_key=${sessionKey}`), []),
    safe(openF1(`/session_result?session_key=${sessionKey}`), []),
    safe(openF1(`/laps?session_key=${sessionKey}`, 30 * 60 * 1000), []),
    safe(openF1(`/pit?session_key=${sessionKey}`), []),
    safe(openF1(`/stints?session_key=${sessionKey}`), []),
    safe(openF1(`/position?session_key=${sessionKey}`), []),
    safe(openF1(`/race_control?session_key=${sessionKey}`), []),
    safe(openF1(`/weather?session_key=${sessionKey}`), []),
    safe(openF1(`/overtakes?session_key=${sessionKey}`), []),
    safe(openF1(`/location?session_key=${sessionKey}`, 30 * 60 * 1000), [])
  ]);

  const enriched = results.map((result) => {
    const driver = drivers.find((item) => item.driver_number === result.driver_number) ?? {};
    const driverLaps = laps.filter((lap) => lap.driver_number === result.driver_number);
    return {
      ...driver,
      driver_number: result.driver_number,
      full_name: driver.full_name ?? `#${result.driver_number}`,
      team_name: driver.team_name ?? '—',
      result,
      bestLap: bestLap(driverLaps),
      avgLap: avgLap(driverLaps),
      pitCount: pits.filter((pit) => pit.driver_number === result.driver_number).length,
      issues: analyzeDriverIssues(result.driver_number, raceControl, result, pits, driverLaps, positions)
    };
  });

  return { drivers, results, enriched, laps, pits, stints, positions, raceControl, weather, overtakes, locations };
}

function sendJson(response, statusCode, data) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
  response.end(JSON.stringify(data));
}

module.exports = async function handler(request, response) {
  try {
    const path = Array.isArray(request.query.path) ? request.query.path : String(request.query.path ?? '').split('/').filter(Boolean);

    if (path[0] === 'meetings') {
      return sendJson(response, 200, await openF1(`/meetings?year=${request.query.year ?? 2025}`));
    }

    if (path[0] === 'sessions') {
      return sendJson(response, 200, await openF1(`/sessions?meeting_key=${request.query.meetingKey}`));
    }

    if (path[0] === 'race' && path[2] === 'summary') {
      const bundle = await buildRaceBundle(path[1]);
      const top3 = [...bundle.enriched]
        .filter((driver) => driver.result?.position)
        .sort((left, right) => (left.result?.position ?? 99) - (right.result?.position ?? 99))
        .slice(0, 3);
      return sendJson(response, 200, {
        ...bundle,
        top3,
        quick: {
          winner: top3[0]?.full_name ?? null,
          fastestLap: Math.min(...bundle.laps.map((lap) => lap.lap_duration ?? Infinity)),
          dnf: bundle.results.filter((result) => result.dnf).length,
          dsq: bundle.results.filter((result) => result.dsq).length,
          incidents: bundle.raceControl.length,
          mostPitStops: [...bundle.enriched].sort((left, right) => right.pitCount - left.pitCount)[0]?.full_name ?? null,
          slowestPit: Math.max(0, ...bundle.pits.map((pit) => pitDuration(pit) ?? 0))
        },
        locations: bundle.locations.filter((_, index) => index % 50 === 0).slice(0, 2500)
      });
    }

    if (path[0] === 'race' && path[2] === 'driver') {
      const bundle = await buildRaceBundle(path[1]);
      const driverNumber = Number(path[3]);
      const driverLaps = bundle.laps.filter((lap) => lap.driver_number === driverNumber);
      return sendJson(response, 200, {
        driver: bundle.enriched.find((driver) => driver.driver_number === driverNumber),
        laps: driverLaps,
        pits: bundle.pits.filter((pit) => pit.driver_number === driverNumber),
        stints: bundle.stints.filter((stint) => stint.driver_number === driverNumber),
        positions: bundle.positions.filter((position) => position.driver_number === driverNumber),
        incidents: bundle.raceControl.filter((event) => event.driver_number === driverNumber),
        stats: { bestLap: bestLap(driverLaps), avgLap: avgLap(driverLaps) }
      });
    }

    if (path[0] === 'race' && path[2] === 'compare') {
      const bundle = await buildRaceBundle(path[1]);
      const summarize = (driverNumber) => ({
        driver: bundle.enriched.find((driver) => driver.driver_number === driverNumber),
        laps: bundle.laps.filter((lap) => lap.driver_number === driverNumber),
        pits: bundle.pits.filter((pit) => pit.driver_number === driverNumber),
        positions: bundle.positions.filter((position) => position.driver_number === driverNumber)
      });
      return sendJson(response, 200, { a: summarize(Number(request.query.driverA)), b: summarize(Number(request.query.driverB)) });
    }

    return sendJson(response, 404, { error: 'Unknown F1 API route' });
  } catch (error) {
    return sendJson(response, 502, { error: String(error) });
  }
};
