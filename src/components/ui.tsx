export const LoadingSkeleton=()=> <div className="card animate-pulse text-slate-400">Загрузка данных OpenF1…</div>;
export const ErrorState=({message}:{message:string})=> <div className="card border-red-500/50 text-red-200">{message}</div>;
export const EmptyState=({message}:{message:string})=> <div className="card text-slate-400">{message}</div>;
