import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh items-center px-6 pt-14 sm:px-10">
      <div className="grid-fine pointer-events-none absolute inset-0 opacity-50" aria-hidden />
      <div className="relative mx-auto w-full max-w-[1800px]">
        <p className="instrument mb-5">Signal lost</p>
        <h1 className="display-xl max-w-3xl text-bone">
          No pathway
          <br />
          to that route.
        </h1>
        <p className="mt-8 max-w-md text-[14.5px] leading-[1.8] text-bone-dim">
          Nothing is here. The network is fine — this particular connection does
          not exist.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className="btn btn-primary">
            Back to the start
          </Link>
          <Link href="/experience" className="btn">
            Choose a process
          </Link>
          <Link href="/brain" className="btn">
            Open the brain viewer
          </Link>
        </div>
      </div>
    </div>
  );
}
