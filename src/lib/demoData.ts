import type {Driver, DriverIssue, Lap, LocationPoint, Meeting, PitStop, PositionPoint, RaceControlEvent, Session, SessionResult, Stint, WeatherPoint} from '../types/openf1';
import {avgLap, bestLap, mergeResults, pitDuration} from './calculations';
import {analyzeDriverIssues} from './issueAnalyzer';

const demoRaceNames = [
  ['Bahrain Grand Prix', 'Bahrain', 'Sakhir'],
  ['Saudi Arabian Grand Prix', 'Saudi Arabia', 'Jeddah'],
  ['Australian Grand Prix', 'Australia', 'Melbourne'],
  ['Japanese Grand Prix', 'Japan', 'Suzuka'],
  ['Miami Grand Prix', 'United States', 'Miami'],
  ['Monaco Grand Prix', 'Monaco', 'Monte Carlo'],
  ['British Grand Prix', 'United Kingdom', 'Silverstone'],
  ['Italian Grand Prix', 'Italy', 'Monza'],
  ['Singapore Grand Prix', 'Singapore', 'Singapore'],
  ['Abu Dhabi Grand Prix', 'United Arab Emirates', 'Yas Marina']
];

export const DEMO_SESSION_KEY = 99001;

export function demoMeetings(year: number): Meeting[] {
  return demoRaceNames.map(([name, country, location], index) => ({
    meeting_key: year * 100 + index + 1,
    meeting_name: name,
    meeting_official_name: `${name} ${year}`,
    country_name: country,
    country_flag: '🏁',
    location,
    date_start: `${year}-${String(Math.min(index + 3, 12)).padStart(2, '0')}-${String((index % 8) + 1).padStart(2, '0')}T12:00:00Z`,
    date_end: `${year}-${String(Math.min(index + 3, 12)).padStart(2, '0')}-${String((index % 8) + 3).padStart(2, '0')}T16:00:00Z`,
    gmt_offset: '+00:00',
    is_cancelled: false
  }));
}

export function demoSessions(meetingKey: number): Session[] {
  const year = Math.floor(meetingKey / 100);
  const index = Math.max(0, meetingKey % 100 - 1);
  const [name, country, location] = demoRaceNames[index] ?? demoRaceNames[0];
  return [{
    session_key: DEMO_SESSION_KEY + index,
    meeting_key: meetingKey,
    session_name: `${name} — Race`,
    session_type: 'Race',
    circuit_short_name: location,
    country_name: country,
    location,
    date_start: `${year}-09-21T12:00:00Z`,
    date_end: `${year}-09-21T14:00:00Z`,
    year
  }];
}

const drivers: Driver[] = [
  {driver_number: 1, full_name: 'Max Verstappen', name_acronym: 'VER', team_name: 'Red Bull Racing', team_colour: '3671C6', headshot_url: 'https://media.formula1.com/d_driver_fallback_image.png'},
  {driver_number: 16, full_name: 'Charles Leclerc', name_acronym: 'LEC', team_name: 'Ferrari', team_colour: 'E80020', headshot_url: 'https://media.formula1.com/d_driver_fallback_image.png'},
  {driver_number: 4, full_name: 'Lando Norris', name_acronym: 'NOR', team_name: 'McLaren', team_colour: 'FF8000', headshot_url: 'https://media.formula1.com/d_driver_fallback_image.png'},
  {driver_number: 44, full_name: 'Lewis Hamilton', name_acronym: 'HAM', team_name: 'Ferrari', team_colour: 'E80020', headshot_url: 'https://media.formula1.com/d_driver_fallback_image.png'},
  {driver_number: 63, full_name: 'George Russell', name_acronym: 'RUS', team_name: 'Mercedes', team_colour: '27F4D2', headshot_url: 'https://media.formula1.com/d_driver_fallback_image.png'},
  {driver_number: 81, full_name: 'Oscar Piastri', name_acronym: 'PIA', team_name: 'McLaren', team_colour: 'FF8000', headshot_url: 'https://media.formula1.com/d_driver_fallback_image.png'}
];

const results: SessionResult[] = drivers.map((driver, index) => ({
  position: index + 1,
  driver_number: driver.driver_number,
  gap_to_leader: index === 0 ? null : `+${(index * 7.842).toFixed(3)}`,
  duration: index === 0 ? 5412.521 : null,
  number_of_laps: index === 5 ? 54 : 57,
  dnf: index === 5,
  dns: false,
  dsq: false
}));

const laps: Lap[] = drivers.flatMap((driver, driverIndex) => Array.from({length: 18}, (_, lapIndex) => ({
  driver_number: driver.driver_number,
  lap_number: lapIndex + 1,
  lap_duration: Number((91.2 + driverIndex * 0.42 + Math.sin(lapIndex / 2) * 1.4 + (lapIndex === 10 && driverIndex === 4 ? 9 : 0)).toFixed(3)),
  duration_sector_1: 29.5 + driverIndex * 0.1,
  duration_sector_2: 31.1 + driverIndex * 0.1,
  duration_sector_3: 30.6 + driverIndex * 0.1,
  i1_speed: 283 - driverIndex,
  i2_speed: 294 - driverIndex,
  st_speed: 318 - driverIndex,
  is_pit_out_lap: lapIndex === 9,
  date_start: `2025-09-21T12:${String(lapIndex).padStart(2, '0')}:00Z`
})));

const pits: PitStop[] = drivers.map((driver, index) => ({
  driver_number: driver.driver_number,
  lap_number: 10 + (index % 3),
  date: `2025-09-21T12:${20 + index}:00Z`,
  lane_duration: 24 + index * 0.8,
  stop_duration: index === 4 ? 5.8 : 2.4 + index * 0.12
}));

const stints: Stint[] = drivers.flatMap((driver) => [
  {driver_number: driver.driver_number, stint_number: 1, compound: 'MEDIUM', lap_start: 1, lap_end: 10, tyre_age_at_start: 0},
  {driver_number: driver.driver_number, stint_number: 2, compound: driver.driver_number === 1 ? 'HARD' : 'SOFT', lap_start: 11, lap_end: 18, tyre_age_at_start: 0}
]);

const raceControl: RaceControlEvent[] = [
  {date: '2025-09-21T12:18:00Z', driver_number: 63, lap_number: 8, category: 'Flag', flag: 'YELLOW', message: 'YELLOW FLAG Sector 2 - car stopped briefly', scope: 'Sector', sector: 2},
  {date: '2025-09-21T12:31:00Z', driver_number: 44, lap_number: 13, category: 'Drs', flag: null, message: 'DRS ENABLED', scope: 'Track'},
  {date: '2025-09-21T12:41:00Z', driver_number: 81, lap_number: 16, category: 'Incident', flag: null, message: 'TRACK LIMITS - LAP TIME DELETED', scope: 'Driver'}
];

const positions: PositionPoint[] = drivers.flatMap((driver, driverIndex) => Array.from({length: 18}, (_, lapIndex) => ({
  driver_number: driver.driver_number,
  date: `2025-09-21T12:${String(lapIndex).padStart(2, '0')}:30Z`,
  position: Math.min(6, Math.max(1, driverIndex + 1 + (lapIndex > 9 && driverIndex === 4 ? 1 : 0)))
})));

const weather: WeatherPoint[] = Array.from({length: 18}, (_, index) => ({
  date: `2025-09-21T12:${String(index).padStart(2, '0')}:00Z`,
  air_temperature: 27 + Math.sin(index / 3),
  track_temperature: 38 + Math.sin(index / 2) * 2,
  humidity: 62 - index * 0.4,
  pressure: 1011,
  rainfall: 0,
  wind_direction: 180,
  wind_speed: 2.5
}));

const locations: LocationPoint[] = drivers.flatMap((driver, driverIndex) => Array.from({length: 80}, (_, index) => {
  const angle = (index / 80) * Math.PI * 2 + driverIndex * 0.08;
  return {
    driver_number: driver.driver_number,
    date: `2025-09-21T12:${String(Math.floor(index / 2)).padStart(2, '0')}:00Z`,
    x: Math.round(Math.cos(angle) * 420 + Math.cos(angle * 3) * 80),
    y: Math.round(Math.sin(angle) * 210 + Math.sin(angle * 2) * 60),
    z: 0
  };
}));

export function demoSummary() {
  const enriched = mergeResults(drivers, results).map((driver) => {
    const driverLaps = laps.filter((lap) => lap.driver_number === driver.driver_number);
    const issues: DriverIssue[] = analyzeDriverIssues(driver.driver_number, raceControl, driver.result, pits, driverLaps, positions);
    return {...driver, bestLap: bestLap(driverLaps), avgLap: avgLap(driverLaps), pitCount: pits.filter((pit) => pit.driver_number === driver.driver_number).length, issues};
  });
  const top3 = enriched.slice(0, 3);
  return {
    isDemo: true,
    drivers,
    results,
    enriched,
    laps,
    pits,
    stints,
    positions,
    raceControl,
    weather,
    overtakes: [],
    locations,
    top3,
    quick: {
      winner: top3[0]?.full_name,
      fastestLap: Math.min(...laps.map((lap) => lap.lap_duration ?? Infinity)),
      dnf: results.filter((result) => result.dnf).length,
      dsq: results.filter((result) => result.dsq).length,
      incidents: raceControl.length,
      mostPitStops: enriched[0]?.full_name,
      slowestPit: Math.max(...pits.map((pit) => pitDuration(pit) ?? 0))
    }
  };
}

export function demoDriver(driverNumber: string) {
  const summary = demoSummary();
  const number = Number(driverNumber) || drivers[0].driver_number;
  const driverLaps = laps.filter((lap) => lap.driver_number === number);
  return {
    driver: summary.enriched.find((driver) => driver.driver_number === number) ?? summary.enriched[0],
    laps: driverLaps,
    pits: pits.filter((pit) => pit.driver_number === number),
    stints: stints.filter((stint) => stint.driver_number === number),
    positions: positions.filter((position) => position.driver_number === number),
    incidents: raceControl.filter((event) => event.driver_number === number),
    stats: {bestLap: bestLap(driverLaps), avgLap: avgLap(driverLaps)}
  };
}

export function demoCompare(driverA: string, driverB: string) {
  const one = (driverNumber: string) => {
    const number = Number(driverNumber) || drivers[0].driver_number;
    return {
      driver: demoSummary().enriched.find((driver) => driver.driver_number === number),
      laps: laps.filter((lap) => lap.driver_number === number),
      pits: pits.filter((pit) => pit.driver_number === number),
      positions: positions.filter((position) => position.driver_number === number)
    };
  };
  return {a: one(driverA), b: one(driverB)};
}
