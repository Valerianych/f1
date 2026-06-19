import {demoCompare, demoDriver, demoMeetings, demoSessions, demoSummary} from './demoData';

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  if (Array.isArray(data) && data.length === 0) throw new Error('OpenF1 вернул пустой массив');
  if (data?.enriched && data.enriched.length === 0) throw new Error('OpenF1 пока не вернул итоги гонки');
  return data;
}

const withFallback = async <T,>(request: Promise<T>, fallback: () => T): Promise<T> => {
  try {
    return await request;
  } catch (error) {
    console.warn('Using demo F1 dataset:', error);
    return fallback();
  }
};

export const f1 = {
  meetings: (year: number) => withFallback(apiGet(`/api/f1/meetings?year=${year}`), () => demoMeetings(year)),
  sessions: (meetingKey: number) => withFallback(apiGet(`/api/f1/sessions?meetingKey=${meetingKey}`), () => demoSessions(meetingKey)),
  summary: (sessionKey: string) => withFallback(apiGet(`/api/f1/race/${sessionKey}/summary`), demoSummary),
  driver: (sessionKey: string, driverNumber: string) => withFallback(apiGet(`/api/f1/race/${sessionKey}/driver/${driverNumber}`), () => demoDriver(driverNumber)),
  compare: (sessionKey: string, driverA: string, driverB: string) => withFallback(apiGet(`/api/f1/race/${sessionKey}/compare?driverA=${driverA}&driverB=${driverB}`), () => demoCompare(driverA, driverB)),
  chat: (body: unknown) => fetch('/api/chat', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)}).then((response) => response.json()).catch(() => ({answer: 'ИИ-чат временно недоступен. Проверьте ключ GigaChat.'}))
};
