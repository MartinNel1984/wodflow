'use client';

const CSS = `*{box-sizing:border-box;margin:0}
html,body{height:100%}
body{background:#16171c;color:#f7f7f4;font-family:'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;display:grid;place-items:center;padding:24px;-webkit-font-smoothing:antialiased}
.wrap{max-width:520px;text-align:center}
.brand{font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#a6a7ad;margin-bottom:36px}
.mark{width:88px;height:88px;margin:0 auto 32px;position:relative}
.mark i{position:absolute;inset:0;border-radius:50%;border:2px solid #f5470c;opacity:0;animation:pulse 2.4s ease-out infinite}
.mark i:nth-child(2){animation-delay:.8s}.mark i:nth-child(3){animation-delay:1.6s}
.mark b{position:absolute;inset:34px;border-radius:50%;background:#f5470c}
@keyframes pulse{0%{transform:scale(.35);opacity:.9}100%{transform:scale(1.1);opacity:0}}
h1{font-size:clamp(30px,6vw,44px);line-height:1.1;font-weight:600;margin-bottom:14px;letter-spacing:-.01em}
p{font-size:17px;line-height:1.55;color:#a6a7ad;margin-bottom:30px}
.btn{display:inline-block;background:#f5470c;color:#fff;text-decoration:none;border:0;cursor:pointer;font:inherit;font-weight:600;font-size:15px;padding:13px 26px;border-radius:999px}
.btn:hover{filter:brightness(.92)}
.code{font-size:13px;color:#a6a7ad;margin-top:26px;opacity:.7}
@media (prefers-reduced-motion:reduce){.mark i{animation:none;opacity:.35;transform:scale(.8)}}`;

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <head>
        <title>Wodflow | Back soon</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Mono:wght@400&display=swap" />
        <style>{CSS}</style>
      </head>
      <body>
        <main className="wrap">
          <div className="brand">Wodflow</div>
          <div className="mark" aria-hidden="true"><i /><i /><i /><b /></div>
          <h1>{"Rest day. Back in 5."}</h1>
          <p>{"Wodflow is updating. Scores and heats are safe. Back in about 5 minutes."}</p>
          <button className="btn" onClick={() => reset()}>Try again</button>
        </main>
      </body>
    </html>
  );
}
