export const fmtTime=(v:unknown):string=>typeof v==='number'?`${v.toFixed(3)} с`:Array.isArray(v)?v.map(fmtTime).join(', '):v?String(v):'—';
export const fmtDate=(s?:string)=>s?new Intl.DateTimeFormat('ru-RU',{dateStyle:'medium'}).format(new Date(s)):'—';
export const statusText=(r?:{dnf?:boolean;dns?:boolean;dsq?:boolean})=>r?.dsq?'DSQ — дисквалифицирован':r?.dns?'DNS — не стартовал':r?.dnf?'DNF — не финишировал':'Финиш';
export const explainTerm=(term:string)=>({pit:'Пит-стоп — заезд в боксы для смены шин или обслуживания.',gap:'Gap — отставание от лидера.',stint:'Stint — отрезок гонки на одном комплекте шин.',sector:'Sector — часть круга трассы.',lap:'Lap — один круг.',interval:'Interval — разрыв до машины впереди.'}[term]??term);
