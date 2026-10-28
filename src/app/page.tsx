export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center space-y-4">
        <p
          className="caption-label text-[var(--color-accent)]"
          style={{ letterSpacing: "0.2em" }}
        >
          Make Your Sound Visible
        </p>
        <h1
          className="heading-display text-[clamp(4rem,12vw,10rem)] text-[var(--color-fg)]"
        >
          AII
        </h1>
        <p className="text-[var(--color-fg-muted)] max-w-md mx-auto">
          Artist Identity Interactive — The platform under construction.
        </p>
      </div>
    </main>
  );
}
