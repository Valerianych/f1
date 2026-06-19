import {useEffect, useState} from 'react';
import {AiChat} from './components/AiChat';
import {DriverCards, IncidentsList, LapTimeChart, PitStopsTable, PodiumCards, PositionChart, RaceHeader, RaceMap, ResultsTable, TyreStrategyChart, WeatherPanel} from './components/RaceParts';
import {RaceSelector} from './components/RaceSelector';
import {EmptyState, ErrorState, LoadingSkeleton} from './components/ui';
import {f1} from './lib/openf1';
import './index.css';

const features = ['итоги гонки', 'карта движения', 'пит-стопы', 'сравнение пилотов', 'инциденты', 'погода', 'ИИ-чат'];

function Home() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <section className="card grid gap-6 bg-[radial-gradient(circle_at_top_right,#ff1e3545,transparent_34%)] md:grid-cols-[1.35fr_.65fr]">
        <div className="relative z-10">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.35em] text-f1-orange">OpenF1 + GigaChat</p>
          <h1 className="max-w-4xl text-5xl font-black leading-none md:text-7xl">F1 Race Analytics</h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">Не пустая главная: выберите сезон и гонку — если OpenF1 не отдаёт данные для 2026 или API временно недоступен, сайт автоматически включает демо-набор с пилотами, кругами, пит-стопами, картой и инцидентами.</p>
        </div>
        <div className="relative z-10 grid gap-3 sm:grid-cols-3 md:grid-cols-1">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4"><p className="text-3xl font-black text-f1-orange">2023–2026</p><p className="text-sm text-slate-400">OpenF1 / demo fallback</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4"><p className="text-3xl font-black text-sky-300">SVG</p><p className="text-sm text-slate-400">карта по x/y координатам</p></div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-4"><p className="text-3xl font-black text-emerald-300">AI</p><p className="text-sm text-slate-400">чат с контекстом гонки</p></div>
        </div>
      </section>

      <RaceSelector />

      <section className="grid gap-4 md:grid-cols-4">
        {features.map((feature, index) => (
          <div className="card group min-h-28 transition hover:-translate-y-1 hover:border-f1-orange/70" key={feature}>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">0{index + 1}</p>
            <h3 className="mt-4 text-xl font-black capitalize">{feature}</h3>
          </div>
        ))}
      </section>
    </main>
  );
}

function RacePage({sessionKey}: {sessionKey: string}) {
  const [data, setData] = useState<any>();
  const [err, setErr] = useState('');
  const [tab, setTab] = useState('results');

  useEffect(() => {
    f1.summary(sessionKey).then(setData).catch((error) => setErr(String(error)));
  }, [sessionKey]);

  if (err) return <main className="p-6"><ErrorState message={err} /></main>;
  if (!data) return <main className="p-6"><LoadingSkeleton /></main>;

  const drivers = [...data.enriched].sort((a: any, b: any) => (a.result?.position ?? 99) - (b.result?.position ?? 99));
  const issues = drivers.flatMap((driver: any) => driver.issues ?? []);

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      {data.isDemo && <div className="card border-f1-orange/50 text-amber-100">Показаны демо-данные: OpenF1 не вернул выбранную гонку или данные ещё не опубликованы. Можно переключить сезон/этап — сайт не останется пустым.</div>}
      <RaceHeader quick={data.quick} />
      <PodiumCards drivers={data.top3} />
      <div className="grid gap-4 md:grid-cols-5">
        {Object.entries(data.quick).map(([key, value]) => <div className="card" key={key}><p className="text-xs uppercase text-slate-500">{key}</p><p className="font-bold">{String(value)}</p></div>)}
      </div>
      <nav className="flex flex-wrap gap-2">{['results', 'map', 'drivers', 'compare', 'incidents', 'weather', 'chat'].map((item) => <button className="btn" onClick={() => setTab(item)} key={item}>{item}</button>)}</nav>
      {tab === 'results' && <ResultsTable drivers={drivers} />}
      {tab === 'map' && <RaceMap points={data.locations} drivers={drivers} />}
      {tab === 'drivers' && <DriverCards drivers={drivers} />}
      {tab === 'incidents' && <IncidentsList events={data.raceControl} issues={issues} />}
      {tab === 'weather' && <WeatherPanel weather={data.weather} />}
      {tab === 'chat' && <AiChat context={{winner: data.quick.winner, top3: data.top3, results: drivers.slice(0, 20), incidents: data.raceControl.slice(0, 20), driverIssues: issues.slice(0, 30)}} />}
      {tab === 'compare' && <CompareInline sessionKey={sessionKey} drivers={drivers} />}
    </main>
  );
}

function CompareInline({sessionKey, drivers}: {sessionKey: string; drivers: any[]}) {
  const [a, setA] = useState(String(drivers[0]?.driver_number ?? ''));
  const [b, setB] = useState(String(drivers[1]?.driver_number ?? ''));
  const [cmp, setCmp] = useState<any>();

  useEffect(() => {
    if (a && b) f1.compare(sessionKey, a, b).then(setCmp);
  }, [a, b, sessionKey]);

  return (
    <div className="space-y-4">
      <div className="card flex flex-col gap-2 md:flex-row">
        <select className="input" value={a} onChange={(event) => setA(event.target.value)}>{drivers.map((driver) => <option key={driver.driver_number} value={driver.driver_number}>{driver.full_name}</option>)}</select>
        <select className="input" value={b} onChange={(event) => setB(event.target.value)}>{drivers.map((driver) => <option key={driver.driver_number} value={driver.driver_number}>{driver.full_name}</option>)}</select>
      </div>
      {cmp && <div className="grid gap-4 md:grid-cols-2"><LapTimeChart laps={cmp.a.laps} /><LapTimeChart laps={cmp.b.laps} /><PositionChart positions={cmp.a.positions} /><PositionChart positions={cmp.b.positions} /></div>}
    </div>
  );
}

function DriverPage({sessionKey, driverNumber}: {sessionKey: string; driverNumber: string}) {
  const [data, setData] = useState<any>();

  useEffect(() => {
    f1.driver(sessionKey, driverNumber).then(setData);
  }, [sessionKey, driverNumber]);

  if (!data) return <main className="p-6"><LoadingSkeleton /></main>;
  const driver = data.driver;
  if (!driver) return <main className="p-6"><EmptyState message="Данные по гонщику пока недоступны." /></main>;

  return (
    <main className="mx-auto max-w-7xl space-y-6 p-5 md:p-8">
      <a className="text-f1-orange" href={`/race/${sessionKey}`}>← назад к гонке</a>
      <section className="card flex flex-col gap-5 md:flex-row">
        {driver.headshot_url && <img src={driver.headshot_url} className="h-40 object-contain" />}
        <div><h1 className="text-4xl font-black">{driver.full_name} #{driver.driver_number}</h1><p style={{color: `#${driver.team_colour}`}}>{driver.team_name}</p><p>Итоговое место: {driver.result?.position ?? '—'} · лучший круг {data.stats.bestLap?.toFixed(3) ?? '—'}</p></div>
      </section>
      <div className="grid gap-4 md:grid-cols-2"><LapTimeChart laps={data.laps} /><PositionChart positions={data.positions} /><PitStopsTable pits={data.pits} /><TyreStrategyChart stints={data.stints} /></div>
      <IncidentsList events={data.incidents} issues={driver.issues ?? []} />
    </main>
  );
}

function App() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'race' && parts[2] === 'driver') return <DriverPage sessionKey={parts[1]} driverNumber={parts[3]} />;
  if (parts[0] === 'race') return <RacePage sessionKey={parts[1]} />;
  return <Home />;
}

export default App;
