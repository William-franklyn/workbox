import Link from "next/link";
import PublicChatWidget from "@/components/ai/PublicChatWidget";
import BrandMark from "@/components/brand/BrandMark";

const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.wb-land{
  --bg:#050609;--panel:#0a0c11;--panel2:#0e1117;--line:#191d26;--line2:#252b37;
  --tx:#e7e9ef;--mut:#8a90a0;--dim:#5a606e;--acc:#8b5cf6;--acc2:#22d3ee;
  font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  background:var(--bg);color:var(--tx);-webkit-font-smoothing:antialiased;line-height:1.55;position:relative;overflow-x:hidden;
}
.wb-land .mono{font-family:ui-monospace,'JetBrains Mono','SF Mono',SFMono-Regular,Menlo,Consolas,monospace}
.wb-land a{text-decoration:none}
.wb-land a:focus-visible{outline:1px solid var(--acc);outline-offset:3px;border-radius:4px}

/* backdrop: grid + glow */
.wb-land .lbg{position:fixed;inset:0;z-index:0;pointer-events:none}
.wb-land .lgrid{position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:56px 56px;opacity:.35;mask-image:radial-gradient(ellipse 90% 60% at 50% 0%,#000 30%,transparent 75%)}
.wb-land .lglow{position:absolute;top:-260px;left:50%;transform:translateX(-50%);width:900px;height:600px;background:radial-gradient(circle at center,rgba(139,92,246,.28),transparent 62%);filter:blur(24px)}
.wb-land .lglow2{position:absolute;top:420px;right:-160px;width:520px;height:520px;background:radial-gradient(circle at center,rgba(34,211,238,.10),transparent 65%);filter:blur(30px)}
.wb-land .lwrap{position:relative;z-index:1}

/* nav */
.wb-land .lnav{position:sticky;top:0;z-index:100;background:rgba(5,6,9,.72);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-bottom:1px solid var(--line);height:60px;display:flex;align-items:center;justify-content:space-between;padding:0 32px}
.wb-land .lnav-logo{display:flex;align-items:center;gap:10px}
.wb-land .llogo-w{width:30px;height:30px;border-radius:8px;background:linear-gradient(145deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 0 0 1px rgba(255,255,255,.08),0 6px 18px rgba(124,58,237,.4)}
.wb-land .llogo-name{font-size:15px;font-weight:600;letter-spacing:-.02em;color:var(--tx)}
.wb-land .lnav-links{display:flex;align-items:center;gap:2px}
.wb-land .lnav-a{color:var(--mut);font-size:13px;padding:8px 13px;border-radius:7px;transition:color .15s}
.wb-land .lnav-a:hover{color:var(--tx)}
.wb-land .lbtn-nav{display:inline-flex;align-items:center;gap:6px;background:var(--tx);color:#05060a;font-size:13px;font-weight:600;padding:8px 15px;border-radius:8px;letter-spacing:-.01em;transition:transform .12s,box-shadow .15s}
.wb-land .lbtn-nav:hover{transform:translateY(-1px);box-shadow:0 8px 20px rgba(255,255,255,.14)}

/* buttons */
.wb-land .lbtn-w{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(145deg,#8b5cf6,#6d28d9);color:#fff;font-size:15px;font-weight:600;padding:14px 26px;border-radius:10px;letter-spacing:-.01em;box-shadow:0 10px 30px rgba(124,58,237,.4),inset 0 1px 0 rgba(255,255,255,.2);transition:transform .12s,box-shadow .15s}
.wb-land .lbtn-w:hover{transform:translateY(-1px);box-shadow:0 14px 40px rgba(124,58,237,.55),inset 0 1px 0 rgba(255,255,255,.25)}
.wb-land .lbtn-ghost{display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,.02);color:var(--tx);font-size:15px;font-weight:500;padding:14px 22px;border-radius:10px;border:1px solid var(--line2);transition:border-color .15s,background .15s}
.wb-land .lbtn-ghost:hover{border-color:#3a4152;background:rgba(255,255,255,.04)}

/* eyebrow / labels */
.wb-land .leyebrow{display:inline-flex;align-items:center;gap:8px;font-size:11px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:var(--acc);background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.25);padding:6px 12px;border-radius:100px;margin-bottom:28px}
.wb-land .leyebrow .ldotp{width:6px;height:6px;border-radius:50%;background:var(--acc);box-shadow:0 0 8px var(--acc)}
.wb-land .lsec-label{font-size:12px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;color:var(--acc);margin-bottom:16px}
.wb-land .lsec-label .lslash{color:var(--dim)}

/* hero */
.wb-land .lhero{display:grid;grid-template-columns:1.05fr .95fr;align-items:center;gap:56px;max-width:1200px;margin:0 auto;padding:88px 32px 72px}
.wb-land .lhero-h1{font-size:clamp(46px,5.4vw,76px);font-weight:700;line-height:1.03;letter-spacing:-.035em;text-wrap:balance;margin-bottom:22px}
.wb-land .lgrad{background:linear-gradient(120deg,#fff 20%,#c4b5fd 55%,#67e8f9 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.wb-land .lhero-sub{font-size:17px;line-height:1.65;color:var(--mut);max-width:460px;margin-bottom:34px}
.wb-land .lhero-ctas{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.wb-land .lhero-note{margin-top:20px;font-size:12px;color:var(--dim);letter-spacing:.01em;display:flex;align-items:center;gap:8px}

/* terminal */
.wb-land .lterm{border-radius:12px;border:1px solid var(--line2);background:linear-gradient(180deg,#0b0d13,#080a0e);box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(139,92,246,.06);overflow:hidden}
.wb-land .lterm-hd{height:38px;background:#0d0f15;border-bottom:1px solid var(--line);display:flex;align-items:center;padding:0 14px;gap:7px}
.wb-land .ldot{width:11px;height:11px;border-radius:50%}
.wb-land .ldot-r{background:#ff5f57}.wb-land .ldot-y{background:#febc2e}.wb-land .ldot-g{background:#28c840}
.wb-land .lterm-ttl{flex:1;text-align:center;font-size:11px;color:var(--dim);letter-spacing:.02em}
.wb-land .lterm-bd{padding:18px;font-size:12.5px;line-height:1.9}
.wb-land .lt-line{white-space:pre-wrap}
.wb-land .lt-p{color:var(--acc2)}.wb-land .lt-cmd{color:#e7e9ef}.wb-land .lt-flag{color:var(--mut)}
.wb-land .lt-out{color:var(--dim)}.wb-land .lt-ok{color:#28c840}.wb-land .lt-key{color:var(--acc)}
.wb-land .lt-wa{color:#25d366}.wb-land .lt-you{color:var(--mut)}
.wb-land .lt-cursor{display:inline-block;width:8px;height:15px;background:var(--acc);vertical-align:-2px;animation:lblink 1.1s steps(2) infinite}
@keyframes lblink{50%{opacity:0}}

/* channels strip */
.wb-land .lchan{border-top:1px solid var(--line);border-bottom:1px solid var(--line);background:rgba(255,255,255,.012)}
.wb-land .lchan-wrap{max-width:1160px;margin:0 auto;padding:22px 32px;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}
.wb-land .lchan-lbl{font-size:12px;color:var(--dim);letter-spacing:.04em}
.wb-land .lchip{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--mut);border:1px solid var(--line2);background:var(--panel);padding:7px 13px;border-radius:100px}
.wb-land .lchip b{color:var(--tx);font-weight:600}
.wb-land .lchip .ld{width:6px;height:6px;border-radius:50%;background:var(--acc)}

/* sections */
.wb-land .lsec{padding:104px 32px;position:relative}
.wb-land .lsec-wrap{max-width:1160px;margin:0 auto}
.wb-land .lsec-h{font-size:clamp(34px,3.9vw,52px);font-weight:700;letter-spacing:-.03em;line-height:1.08;text-wrap:balance;margin-bottom:52px}
.wb-land .lsec-h .lgrad{background:linear-gradient(120deg,#fff,#c4b5fd)}
.wb-land .ltopline{border-top:1px solid var(--line)}

/* how it works */
.wb-land .lhiw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.wb-land .lhiw-step{position:relative;padding:30px 26px;border:1px solid var(--line);border-radius:14px;background:var(--panel);transition:border-color .2s,transform .2s}
.wb-land .lhiw-step:hover{border-color:var(--line2);transform:translateY(-3px)}
.wb-land .lhiw-num{font-size:12px;font-weight:600;letter-spacing:.1em;color:var(--acc);margin-bottom:18px}
.wb-land .lhiw-t{font-size:19px;font-weight:600;letter-spacing:-.02em;margin-bottom:9px}
.wb-land .lhiw-d{font-size:14px;line-height:1.65;color:var(--mut)}
.wb-land .lhiw-tag{display:inline-block;margin-top:16px;font-size:11px;color:var(--dim);border:1px solid var(--line);padding:4px 10px;border-radius:5px}

/* bento */
.wb-land .lbento{display:grid;grid-template-columns:repeat(12,1fr);gap:12px}
.wb-land .lbc{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:28px;transition:border-color .2s,transform .2s}
.wb-land .lbc:hover{border-color:var(--line2);transform:translateY(-3px)}
.wb-land .lbc:nth-child(1){grid-column:span 7}
.wb-land .lbc:nth-child(2){grid-column:span 5}
.wb-land .lbc:nth-child(3){grid-column:span 4}
.wb-land .lbc:nth-child(4){grid-column:span 4}
.wb-land .lbc:nth-child(5){grid-column:span 4}
.wb-land .lbc-lbl{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--acc);margin-bottom:12px}
.wb-land .lbc-t{font-size:20px;font-weight:600;letter-spacing:-.02em;margin-bottom:8px;text-wrap:balance}
.wb-land .lbc-d{font-size:13.5px;line-height:1.6;color:var(--mut);max-width:400px}
.wb-land .lbc-bullets{list-style:none;margin-top:16px}
.wb-land .lbc-bullets li{font-size:12.5px;color:var(--mut);padding:6px 0;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:9px}
.wb-land .lbc-bullets li:last-child{border-bottom:none}
.wb-land .lbc-bullets li::before{content:'▸';color:var(--acc);font-size:10px}
.wb-land .lmk{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:22px;padding:14px;background:var(--bg);border:1px solid var(--line);border-radius:10px}
.wb-land .lmk-h{font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}
.wb-land .lmk-card{background:var(--panel2);border:1px solid var(--line);border-radius:6px;padding:8px 9px;margin-bottom:5px;font-size:10px;color:var(--mut);line-height:1.35}

/* AI */
.wb-land .lai-grid{display:grid;grid-template-columns:1fr 1fr;gap:72px;align-items:center}
.wb-land .lai-h{font-size:clamp(32px,3.6vw,46px);font-weight:700;letter-spacing:-.03em;line-height:1.12;text-wrap:balance;margin-bottom:18px}
.wb-land .lai-sub{font-size:15px;line-height:1.7;color:var(--mut);margin-bottom:26px}
.wb-land .lai-pts{list-style:none;border-top:1px solid var(--line)}
.wb-land .lai-pt{display:flex;align-items:flex-start;gap:12px;padding:13px 0;border-bottom:1px solid var(--line);font-size:13.5px;color:var(--mut)}
.wb-land .lai-pt strong{color:var(--tx);font-weight:500}
.wb-land .lai-check{width:18px;height:18px;border-radius:50%;background:rgba(139,92,246,.12);border:1px solid rgba(139,92,246,.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;color:var(--acc);font-size:9px}
.wb-land .lchat-mock{background:linear-gradient(180deg,#0b0d13,#080a0e);border:1px solid var(--line2);border-radius:16px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.6)}
.wb-land .lchat-hd{background:#0d0f15;border-bottom:1px solid var(--line);padding:12px 16px;display:flex;align-items:center;gap:10px}
.wb-land .lchat-av{width:30px;height:30px;border-radius:8px;background:linear-gradient(145deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.wb-land .lchat-nm{font-size:12.5px;font-weight:600;color:var(--tx)}
.wb-land .lchat-st{font-size:10px;color:var(--dim)}
.wb-land .lchat-bd{padding:16px;display:flex;flex-direction:column;gap:11px;min-height:270px}
.wb-land .lmsg{display:flex;gap:8px}
.wb-land .lmsg-u{flex-direction:row-reverse}
.wb-land .lbubble{max-width:80%;font-size:12.5px;line-height:1.5;padding:10px 13px;border-radius:12px}
.wb-land .lbubble-ai{background:var(--panel2);border:1px solid var(--line2);color:#c9cdd7;border-bottom-left-radius:3px}
.wb-land .lbubble-u{background:linear-gradient(145deg,#8b5cf6,#6d28d9);color:#fff;border-bottom-right-radius:3px}
.wb-land .lmavt{width:24px;height:24px;border-radius:7px;flex-shrink:0;margin-top:2px}
.wb-land .lmavt-ai{background:linear-gradient(145deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center}
.wb-land .lmavt-u{background:#222633;border-radius:50%}
.wb-land .lchat-inp{margin:0 16px 16px;background:var(--bg);border:1px solid var(--line2);border-radius:9px;padding:11px 14px;display:flex;align-items:center;justify-content:space-between}
.wb-land .lchat-ph{font-size:11px;color:var(--dim)}
.wb-land .lchat-snd{width:24px;height:24px;border-radius:6px;background:var(--acc);display:flex;align-items:center;justify-content:center;flex-shrink:0}
.wb-land .larrow{width:0;height:0;border-style:solid;border-width:4px 0 4px 6px;border-color:transparent transparent transparent #fff;margin-left:2px}

/* modules */
.wb-land .lmods-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.wb-land .lmod{background:var(--panel);padding:24px 22px;transition:background .2s}
.wb-land .lmod:hover{background:var(--panel2)}
.wb-land .lmod-ico{width:30px;height:30px;border-radius:8px;background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.25);display:flex;align-items:center;justify-content:center;color:var(--acc);margin-bottom:14px}
.wb-land .lmod-t{font-size:14px;font-weight:600;margin-bottom:6px;letter-spacing:-.01em}
.wb-land .lmod-d{font-size:12.5px;line-height:1.55;color:var(--mut)}

/* comparison */
.wb-land .lcmp-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:16px}
.wb-land .lcmp-table{width:100%;border-collapse:collapse;min-width:620px}
.wb-land .lcmp-table th{padding:16px 20px;text-align:left;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--dim);border-bottom:1px solid var(--line);background:var(--panel)}
.wb-land .lcmp-col-wb{color:var(--acc)!important}
.wb-land .lcmp-table td{padding:14px 20px;font-size:14px;border-bottom:1px solid var(--line);color:var(--mut)}
.wb-land .lcmp-table td:first-child{font-weight:500;color:var(--tx)}
.wb-land .lcmp-table tr:last-child td{border-bottom:none}
.wb-land .lcmp-yes{color:#28c840;font-weight:600}
.wb-land .lcmp-no{color:var(--dim)}
.wb-land .lcmp-part{color:var(--mut)}

/* testimonials */
.wb-land .ltg{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:48px}
.wb-land .lt{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:28px}
.wb-land .lt-q{font-size:14px;line-height:1.7;color:var(--mut);margin-bottom:22px;text-wrap:pretty}
.wb-land .lt-q em{font-style:normal;color:var(--tx)}
.wb-land .lt-au{display:flex;align-items:center;gap:10px}
.wb-land .lt-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(145deg,#8b5cf6,#6d28d9);flex-shrink:0}
.wb-land .lt-nm{font-size:13px;font-weight:600;color:var(--tx)}
.wb-land .lt-rl{font-size:11px;color:var(--dim)}

/* CTA */
.wb-land .lcta{text-align:center;position:relative}
.wb-land .lcta-card{max-width:820px;margin:0 auto;padding:64px 40px;border:1px solid var(--line2);border-radius:24px;background:linear-gradient(180deg,rgba(139,92,246,.08),rgba(10,12,17,.4));position:relative;overflow:hidden}
.wb-land .lcta-h{font-size:clamp(36px,4.6vw,60px);font-weight:700;letter-spacing:-.03em;line-height:1.06;text-wrap:balance;margin-bottom:16px}
.wb-land .lcta-sub{font-size:16px;color:var(--mut);margin-bottom:36px}
.wb-land .lcta-note{margin-top:18px;font-size:12px;color:var(--dim)}

/* footer */
.wb-land .lfooter{border-top:1px solid var(--line);padding:36px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px}
.wb-land .lf-logo{display:flex;align-items:center;gap:9px}
.wb-land .lf-lw{width:26px;height:26px;border-radius:7px;background:linear-gradient(145deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center}
.wb-land .lf-ln{font-size:13px;font-weight:600;color:var(--mut)}
.wb-land .lf-copy{font-size:12px;color:var(--dim)}
.wb-land .lf-links{display:flex;gap:22px}
.wb-land .lf-lk{font-size:13px;color:var(--mut);transition:color .15s}
.wb-land .lf-lk:hover{color:var(--tx)}

@media(max-width:960px){
  .wb-land .lhero{grid-template-columns:1fr;gap:44px;padding:64px 22px 56px}
  .wb-land .lai-grid{grid-template-columns:1fr;gap:44px}
  .wb-land .lhiw-grid{grid-template-columns:1fr}
  .wb-land .lbc:nth-child(1),.wb-land .lbc:nth-child(2){grid-column:span 12}
  .wb-land .lbc:nth-child(3),.wb-land .lbc:nth-child(4),.wb-land .lbc:nth-child(5){grid-column:span 6}
  .wb-land .lmods-grid{grid-template-columns:repeat(2,1fr)}
  .wb-land .lsec{padding:76px 22px}
  .wb-land .lnav{padding:0 18px}
}
@media(max-width:640px){
  .wb-land .lbc:nth-child(n){grid-column:span 12}
  .wb-land .ltg{grid-template-columns:1fr}
  .wb-land .lmods-grid{grid-template-columns:1fr}
  .wb-land .lfooter{flex-direction:column;text-align:center}
  .wb-land .lnav-a[href^="#"]{display:none}
  .wb-land .lchan-lbl{display:none}
}
`;

export default function LandingPage() {
  return (
    <>
      <style>{css}</style>
      <div className="wb-land">
        <div className="lbg"><div className="lgrid" /><div className="lglow" /><div className="lglow2" /></div>
        <div className="lwrap">

          {/* NAV */}
          <nav className="lnav">
            <Link href="/" className="lnav-logo">
              <div className="llogo-w"><BrandMark size={16} color="#ffffff" /></div>
              <span className="llogo-name">WorkBox</span>
            </Link>
            <div className="lnav-links">
              <a href="#channels" className="lnav-a">Control</a>
              <a href="#features" className="lnav-a">Features</a>
              <a href="#ai" className="lnav-a">AI</a>
              <a href="#modules" className="lnav-a">Platform</a>
              <Link href="/login" className="lnav-a">Sign in</Link>
              <Link href="/signup" className="lbtn-nav">Start free →</Link>
            </div>
          </nav>

          {/* HERO */}
          <section className="lhero">
            <div>
              <span className="leyebrow"><span className="ldotp" /> AI-native workspace</span>
              <h1 className="lhero-h1">The workspace that <span className="lgrad">runs itself</span>.</h1>
              <p className="lhero-sub">Tasks, docs, CRM, goals and meetings in one place — operated by your team <b style={{ color: "#c9cdd7" }}>and</b> by AI agents. Drive it from the app, over WhatsApp, or straight from the API.</p>
              <div className="lhero-ctas">
                <Link href="/signup" className="lbtn-w">Start for free →</Link>
                <a href="#channels" className="lbtn-ghost">See how it works</a>
              </div>
              <p className="lhero-note mono">$ no credit card · free plan · live in 2 min</p>
            </div>

            <div className="lterm">
              <div className="lterm-hd">
                <span className="ldot ldot-r" /><span className="ldot ldot-y" /><span className="ldot ldot-g" />
                <span className="lterm-ttl mono">workbox — control any way you work</span>
              </div>
              <div className="lterm-bd mono">
                <div className="lt-line"><span className="lt-p">$ </span><span className="lt-cmd">curl -X POST workbox.app/api/v1/tasks \</span></div>
                <div className="lt-line"><span className="lt-flag">    -H </span><span className="lt-key">&quot;Authorization: Bearer wbx_live_••••&quot;</span><span className="lt-flag"> \</span></div>
                <div className="lt-line"><span className="lt-flag">    -d </span><span className="lt-out">&apos;&#123;&quot;title&quot;:&quot;Ship v2&quot;,&quot;due&quot;:&quot;tomorrow&quot;&#125;&apos;</span></div>
                <div className="lt-line lt-ok">  ✓ task created · assigned · on the calendar</div>
                <div className="lt-line">&nbsp;</div>
                <div className="lt-line"><span className="lt-wa"># over WhatsApp</span></div>
                <div className="lt-line"><span className="lt-you">You › </span><span className="lt-cmd">what&apos;s overdue this sprint?</span></div>
                <div className="lt-line"><span className="lt-key">WorkBox › </span><span className="lt-out">7 overdue — 3 Eng, 2 Marketing, 2 HR.</span></div>
                <div className="lt-line"><span className="lt-out">           reschedule them? </span><span className="lt-cursor" /></div>
              </div>
            </div>
          </section>

          {/* CHANNELS */}
          <div className="lchan" id="channels">
            <div className="lchan-wrap">
              <span className="lchan-lbl mono">Control it from →</span>
              {[
                ["In-app", true], ["WhatsApp", true], ["SMS", true], ["REST API", false], ["MCP for agents", false],
              ].map(([c, dot]) => (
                <span key={c as string} className="lchip mono">{dot ? <span className="ld" /> : null}<b>{c}</b></span>
              ))}
            </div>
          </div>

          {/* HOW IT WORKS */}
          <section className="lsec" id="how">
            <div className="lsec-wrap">
              <div className="lsec-label mono"><span className="lslash">01 / </span>Getting started</div>
              <h2 className="lsec-h">Up and running<br />before lunch.</h2>
              <div className="lhiw-grid">
                {[
                  { n: "STEP 01", t: "Spin up a workspace", d: "Pick a template for your team — engineering, marketing, ops — or start blank. Spaces, lists and folders ready in under 2 minutes.", tag: "Pre-built templates" },
                  { n: "STEP 02", t: "Invite your team & agents", d: "Add teammates by link, and connect AI agents over MCP or an API key. Humans and agents share the same workspace.", tag: "Unlimited seats, free plan" },
                  { n: "STEP 03", t: "Drive it any way", d: "List, Kanban, Calendar or Table. Message it on WhatsApp, hit the REST API, or let the AI surface what needs you.", tag: "API · MCP · WhatsApp · SMS" },
                ].map(s => (
                  <div key={s.n} className="lhiw-step">
                    <div className="lhiw-num mono">{s.n}</div>
                    <div className="lhiw-t">{s.t}</div>
                    <div className="lhiw-d">{s.d}</div>
                    <span className="lhiw-tag mono">{s.tag}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* FEATURES */}
          <section className="lsec ltopline" id="features">
            <div className="lsec-wrap">
              <div className="lsec-label mono"><span className="lslash">02 / </span>Core platform</div>
              <h2 className="lsec-h">Everything your team<br />needs to move fast.</h2>
              <div className="lbento">
                <div className="lbc">
                  <div className="lbc-lbl">Tasks &amp; Projects</div>
                  <div className="lbc-t">Four views. One source of truth.</div>
                  <div className="lbc-d">Manage every task in List, Kanban, Calendar or Table — all the same data. Owners, priorities, dependencies, recurrence, drag-and-drop, no reloads.</div>
                  <div className="lmk">
                    <div><div className="lmk-h">To do</div><div className="lmk-card">Redesign onboarding</div><div className="lmk-card">Write update email</div></div>
                    <div><div className="lmk-h">In progress</div><div className="lmk-card">Integrate billing</div><div className="lmk-card">Fix mobile nav</div></div>
                    <div><div className="lmk-h">Done</div><div className="lmk-card">Ship v2.3</div><div className="lmk-card">Hire engineer</div></div>
                  </div>
                </div>
                <div className="lbc">
                  <div className="lbc-lbl">Goals &amp; OKRs</div>
                  <div className="lbc-t">Connect daily work to what matters.</div>
                  <div className="lbc-d">Company, team and personal objectives. Link tasks to key results so progress updates itself — and see who moved the needle.</div>
                  <ul className="lbc-bullets">
                    <li>Shared goals with per-member contribution</li>
                    <li>Automatic progress from linked tasks</li>
                    <li>Portfolio view for leadership</li>
                  </ul>
                </div>
                <div className="lbc">
                  <div className="lbc-lbl">Docs &amp; Knowledge</div>
                  <div className="lbc-t">Your team&apos;s brain.</div>
                  <div className="lbc-d">Rich docs with a Drive-style manager, templates, and export to Word/PDF. Full-text and semantic search across everything.</div>
                  <ul className="lbc-bullets">
                    <li>Templates + inline editor</li>
                    <li>Share links, export .docx / .pdf</li>
                    <li>Semantic search (RAG)</li>
                  </ul>
                </div>
                <div className="lbc">
                  <div className="lbc-lbl">CRM &amp; Outreach</div>
                  <div className="lbc-t">Pipeline that acts.</div>
                  <div className="lbc-d">Contacts, companies and deals — enriched, drafted and sent. Turn a lead into a sequenced campaign without leaving the workspace.</div>
                  <ul className="lbc-bullets">
                    <li>Contact enrichment</li>
                    <li>AI-drafted outreach</li>
                    <li>Bookmarks for leads &amp; opportunities</li>
                  </ul>
                </div>
                <div className="lbc">
                  <div className="lbc-lbl">Open by design</div>
                  <div className="lbc-t">API, MCP &amp; webhooks.</div>
                  <div className="lbc-d">A full REST API with per-user keys, an MCP server so AI agents can operate your workspace, and webhooks to wire it into anything.</div>
                  <ul className="lbc-bullets">
                    <li>REST API + API keys</li>
                    <li>MCP server for agents</li>
                    <li>Browser extension &amp; webhooks</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* AI */}
          <section className="lsec ltopline" id="ai">
            <div className="lsec-wrap">
              <div className="lai-grid">
                <div>
                  <div className="lsec-label mono"><span className="lslash">03 / </span>AI assistant</div>
                  <h2 className="lai-h">An AI that actually knows your workspace.</h2>
                  <p className="lai-sub">WorkBox&apos;s agent is built into every page — it reads your tasks, docs, goals and calendar, then acts. The same agent answers on WhatsApp and runs over the API.</p>
                  <ul className="lai-pts">
                    {[
                      <><strong>Context-aware on every page</strong> — knows your backlog on Tasks, your KB on Docs</>,
                      <>Ask <em>&ldquo;what&apos;s overdue this sprint?&rdquo;</em> and get a real, specific answer</>,
                      <><strong>Creates tasks, forms and docs</strong> from a plain-English description</>,
                      <>Understands <strong>voice notes</strong> on WhatsApp — talk, don&apos;t type</>,
                      <>Analyzes a CSV and replies with a chart, right in the chat</>,
                      <>Runs the same over <strong>MCP</strong> so your own agents can operate it</>,
                    ].map((pt, i) => (
                      <li key={i} className="lai-pt"><div className="lai-check">✓</div><span>{pt}</span></li>
                    ))}
                  </ul>
                </div>
                <div className="lchat-mock">
                  <div className="lchat-hd">
                    <div className="lchat-av"><BrandMark size={15} color="#ffffff" /></div>
                    <div><div className="lchat-nm">WorkBox AI</div><div className="lchat-st mono">online · via WhatsApp</div></div>
                  </div>
                  <div className="lchat-bd">
                    <div className="lmsg"><div className="lmavt lmavt-ai"><BrandMark size={12} color="#ffffff" /></div><div className="lbubble lbubble-ai">Morning 👋 You have <strong style={{ color: "#e7e9ef" }}>4 overdue</strong> and 10 due today. Want the priority order?</div></div>
                    <div className="lmsg lmsg-u"><div className="lmavt lmavt-u" /><div className="lbubble lbubble-u">create a task to review the Q3 budget, due friday</div></div>
                    <div className="lmsg"><div className="lmavt lmavt-ai"><BrandMark size={12} color="#ffffff" /></div><div className="lbubble lbubble-ai">Done — <strong style={{ color: "#e7e9ef" }}>Review Q3 budget</strong> added to Finance, due Fri. Assigned to you.</div></div>
                    <div className="lmsg lmsg-u"><div className="lmavt lmavt-u" /><div className="lbubble lbubble-u">🎤 voice note</div></div>
                    <div className="lmsg"><div className="lmavt lmavt-ai"><BrandMark size={12} color="#ffffff" /></div><div className="lbubble lbubble-ai">Got it — I transcribed that and booked the client call for Thu 2pm with a Meet link.</div></div>
                  </div>
                  <div className="lchat-inp">
                    <span className="lchat-ph mono">message WorkBox…</span>
                    <div className="lchat-snd"><div className="larrow" /></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* MODULES */}
          <section className="lsec ltopline" id="modules">
            <div className="lsec-wrap">
              <div className="lsec-label mono"><span className="lslash">04 / </span>Complete platform</div>
              <h2 className="lsec-h">One subscription.<br />Every tool your team opens.</h2>
              <div className="lmods-grid">
                {[
                  { t: "Tasks & Projects", d: "List, Kanban, Calendar, Table. Subtasks, dependencies, recurrence." },
                  { t: "AI Assistant", d: "Context-aware on every page. Creates tasks, forms and docs from words." },
                  { t: "Docs & Drive", d: "Drive-style manager, inline editor, templates, Word/PDF export." },
                  { t: "CRM & Outreach", d: "Contacts, deals, enrichment, AI-drafted email sequences." },
                  { t: "Goals & OKRs", d: "Objectives linked to tasks with per-member contribution tracking." },
                  { t: "Meetings", d: "Schedule with Google Meet links, agendas and action items." },
                  { t: "Forms", d: "Surveys and intake forms with 15+ field types. Share via link or QR." },
                  { t: "Bookmarks", d: "Chrome-style folders of saved people, companies and opportunities." },
                  { t: "Knowledge Base", d: "Categorised articles with semantic search. Your always-current wiki." },
                  { t: "Time & Budget", d: "Log hours against tasks, track expenses and project budgets." },
                  { t: "Sticky Notes", d: "Floating notes that follow you across the whole app." },
                  { t: "Automations", d: "Trigger actions on status changes and deadlines. No code." },
                ].map(m => (
                  <div key={m.t} className="lmod">
                    <div className="lmod-ico"><BrandMark size={14} color="currentColor" /></div>
                    <div className="lmod-t">{m.t}</div>
                    <div className="lmod-d">{m.d}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* COMPARISON */}
          <section className="lsec ltopline">
            <div className="lsec-wrap">
              <div className="lsec-label mono"><span className="lslash">05 / </span>Why WorkBox</div>
              <h2 className="lsec-h">One tool instead of five.</h2>
              <div className="lcmp-wrap">
                <table className="lcmp-table">
                  <thead>
                    <tr>
                      <th>Capability</th>
                      <th className="lcmp-col-wb">WorkBox</th>
                      <th>Notion</th>
                      <th>Asana</th>
                      <th>Monday</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Task management", "✓", "Partial", "✓", "✓"],
                      ["AI agent, context-aware", "✓", "Add-on", "—", "Limited"],
                      ["Control by WhatsApp / SMS", "✓", "—", "—", "—"],
                      ["MCP server for AI agents", "✓", "—", "—", "—"],
                      ["Docs + knowledge base", "✓", "✓", "—", "—"],
                      ["CRM + outreach", "✓", "Template", "—", "Add-on"],
                      ["Forms, Goals, Budget, HR", "✓", "Partial", "—", "Add-on"],
                      ["Free plan", "✓", "✓", "Limited", "—"],
                    ].map(([feat, ...cols]) => (
                      <tr key={feat as string}>
                        <td>{feat}</td>
                        {(cols as string[]).map((v, i) => (
                          <td key={i} className={v === "—" ? "lcmp-no" : v === "✓" ? "lcmp-yes" : "lcmp-part"}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* TESTIMONIALS */}
          <section className="lsec ltopline">
            <div className="lsec-wrap">
              <div className="lsec-label mono"><span className="lslash">06 / </span>What teams say</div>
              <h2 className="lsec-h" style={{ marginBottom: 0 }}>Teams that stopped tool-hopping.</h2>
              <div className="ltg">
                {[
                  { q: <>&ldquo;We replaced Asana, Notion and two spreadsheets. My team runs half of it <em>from WhatsApp</em> now.&rdquo;</>, n: "Sarah M.", r: "Head of Ops, Series B startup" },
                  { q: <>&ldquo;The API and MCP support meant our own agents could book meetings and file tasks on day one.&rdquo;</>, n: "James T.", r: "Eng Lead, product agency" },
                  { q: <>&ldquo;Set up tasks, docs, CRM and the KB in one afternoon. New hires are self-sufficient by noon.&rdquo;</>, n: "Priya K.", r: "CEO, consulting firm" },
                ].map(t => (
                  <div key={t.n} className="lt">
                    <p className="lt-q">{t.q}</p>
                    <div className="lt-au"><div className="lt-av" /><div><div className="lt-nm">{t.n}</div><div className="lt-rl">{t.r}</div></div></div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="lsec lcta">
            <div className="lcta-card">
              <h2 className="lcta-h">Ship work, not <span className="lgrad">tool sprawl</span>.</h2>
              <p className="lcta-sub">Set up in under 2 minutes. No credit card. No onboarding calls.</p>
              <Link href="/signup" className="lbtn-w">Start for free →</Link>
              <p className="lcta-note mono">free plan · unlimited members · cancel anytime</p>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="lfooter">
            <div className="lf-logo">
              <div className="lf-lw"><BrandMark size={14} color="#ffffff" /></div>
              <span className="lf-ln">WorkBox</span>
            </div>
            <span className="lf-copy">© {new Date().getFullYear()} WorkBox. Built for teams and their agents.</span>
            <div className="lf-links">
              <Link href="/privacy" className="lf-lk">Privacy</Link>
              <Link href="/login" className="lf-lk">Sign in</Link>
              <Link href="/signup" className="lf-lk">Get started</Link>
            </div>
          </footer>

          <PublicChatWidget />
        </div>
      </div>
    </>
  );
}
