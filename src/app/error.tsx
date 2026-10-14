"use client";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: RootErrorProps) {
  const reference = error.digest;

  return (
    <main className="grid min-h-dvh place-items-center bg-[#0c1117] p-6 text-white" role="alert">
      <section className="w-full max-w-lg border border-white/15 bg-white/5 p-7">
        <p className="text-xs font-bold tracking-[0.16em] text-sky-300">APPLICATION_ERROR</p>
        <h1 className="mt-3 text-2xl font-bold">Не удалось открыть страницу</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">Обновите страницу. Если ошибка повторится, передайте поддержке код обращения.</p>
        {reference ? <p className="mt-5 font-mono text-xs text-slate-400">{reference}</p> : null}
        <button className="mt-6 border border-white/30 px-4 py-2 text-sm font-semibold hover:bg-white/10" onClick={reset} type="button">
          Повторить
        </button>
      </section>
    </main>
  );
}
