import Link from "next/link";
import PublicChatWidget from "@/components/ai/PublicChatWidget";

const css = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
.wb-land{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#000;color:#fff;-webkit-font-smoothing:antialiased;line-height:1.5}
.wb-land a:focus-visible{outline:2px solid #fff;outline-offset:3px;border-radius:4px}
.wb-land .lnav{position:sticky;top:0;z-index:100;background:rgba(0,0,0,.88);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid #1c1c1c;height:58px;display:flex;align-items:center;justify-content:space-between;padding:0 40px}
.wb-land .lnav-logo{display:flex;align-items:center;gap:9px;text-decoration:none}
.wb-land .llogo-w{width:28px;height:28px;border-radius:7px;background:#fff;color:#000;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:900;letter-spacing:-.05em;flex-shrink:0}
.wb-land .llogo-name{font-size:15px;font-weight:700;letter-spacing:-.03em;color:#fff}
.wb-land .lnav-links{display:flex;align-items:center;gap:4px}
.wb-land .lnav-a{text-decoration:none;color:#707070;font-size:14px;padding:7px 14px;border-radius:6px;transition:color .15s}
.wb-land .lnav-a:hover{color:#fff}
.wb-land .lbtn-nav{display:inline-flex;align-items:center;background:#fff;color:#000;font-size:13px;font-weight:700;padding:8px 18px;border-radius:6px;text-decoration:none;letter-spacing:-.01em;transition:opacity .15s}
.wb-land .lbtn-nav:hover{opacity:.85}
.wb-land .lbtn-w{display:inline-flex;align-items:center;background:#fff;color:#000;font-size:15px;font-weight:700;padding:13px 28px;border-radius:8px;text-decoration:none;letter-spacing:-.01em;transition:opacity .15s}
.wb-land .lbtn-w:hover{opacity:.85}
.wb-land .lbtn-ghost{display:inline-flex;align-items:center;background:transparent;color:#999;font-size:15px;font-weight:500;padding:13px 24px;border-radius:8px;text-decoration:none;border:1px solid #2a2a2a;transition:border-color .15s,color .15s}
.wb-land .lbtn-ghost:hover{border-color:#555;color:#fff}
.wb-land .lbtn-dark{display:inline-flex;align-items:center;background:#000;color:#fff;font-size:15px;font-weight:700;padding:13px 28px;border-radius:8px;text-decoration:none;letter-spacing:-.01em;border:2px solid #000;transition:background .15s}
.wb-land .lbtn-dark:hover{background:#1a1a1a}
.wb-land .lhero{min-height:calc(100vh - 58px);display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:60px;max-width:1200px;margin:0 auto;padding:80px 40px}
.wb-land .lhero-copy{padding-right:20px}
.wb-land .leyebrow{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#555;border:1px solid #2a2a2a;padding:5px 11px;border-radius:4px;margin-bottom:28px}
.wb-land .lhero-h1{font-family:Georgia,'Times New Roman',Times,serif;font-size:clamp(50px,5.5vw,82px);font-weight:700;line-height:1.02;letter-spacing:-.03em;color:#fff;text-wrap:balance;margin-bottom:22px}
.wb-land .lhero-sub{font-size:17px;line-height:1.65;color:#707070;max-width:440px;margin-bottom:36px}
.wb-land .lhero-ctas{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.wb-land .lhero-note{margin-top:18px;font-size:12px;color:#404040;letter-spacing:.01em}
.wb-land .lmockup{border-radius:13px;overflow:hidden;border:1px solid #2a2a2a;background:#0d0d0d;box-shadow:0 32px 80px rgba(0,0,0,.9)}
.wb-land .lmc{height:36px;background:#161616;border-bottom:1px solid #202020;display:flex;align-items:center;padding:0 14px;gap:7px}
.wb-land .ldot{width:10px;height:10px;border-radius:50%;background:#2e2e2e}
.wb-land .lmc-url{flex:1;margin:0 10px;height:21px;background:#1e1e1e;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#3a3a3a;letter-spacing:.02em}
.wb-land .lmb{display:flex;height:360px}
.wb-land .lm-rail{width:44px;background:#111;border-right:1px solid #1a1a1a;display:flex;flex-direction:column;align-items:center;padding:10px 0;gap:4px}
.wb-land .lrail-w{width:26px;height:26px;border-radius:6px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#000;margin-bottom:8px}
.wb-land .lri{width:28px;height:28px;border-radius:6px;display:flex;align-items:center;justify-content:center}
.wb-land .lri-a{background:#1e1e1e}
.wb-land .lri-ico{width:12px;height:12px;border-radius:2px;background:#333}
.wb-land .lri-ico-a{background:#666}
.wb-land .lm-side{width:156px;background:#111;border-right:1px solid #1a1a1a;padding:14px 10px}
.wb-land .lss{font-size:9px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#333;padding:0 6px;margin-bottom:6px;margin-top:10px}
.wb-land .lsi{display:flex;align-items:center;gap:7px;padding:5px 6px;border-radius:5px;margin-bottom:1px}
.wb-land .lsi-a{background:#1c1c1c}
.wb-land .lsi-d{width:6px;height:6px;border-radius:50%;background:#2e2e2e;flex-shrink:0}
.wb-land .lsi-d-a{background:#555}
.wb-land .lsi-t{font-size:11px;color:#444}
.wb-land .lsi-t-a{color:#bbb}
.wb-land .lm-main{flex:1;padding:14px;background:#0d0d0d;overflow:hidden}
.wb-land .lm-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.wb-land .lm-title{font-size:12px;font-weight:600;color:#ccc;letter-spacing:-.01em}
.wb-land .lm-badge{font-size:9px;color:#444;background:#161616;border:1px solid #222;padding:2px 8px;border-radius:3px}
.wb-land .lkanban{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.wb-land .lkcol-h{font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#333;margin-bottom:6px;display:flex;align-items:center;gap:5px}
.wb-land .lk-n{font-size:9px;background:#1a1a1a;padding:1px 5px;border-radius:3px;color:#3a3a3a}
.wb-land .lkcard{background:#161616;border:1px solid #1e1e1e;border-radius:6px;padding:8px 9px;margin-bottom:5px}
.wb-land .lkcard-t{font-size:10px;color:#aaa;margin-bottom:5px;line-height:1.35}
.wb-land .lkcard-meta{display:flex;align-items:center;gap:4px}
.wb-land .lktag{font-size:9px;padding:2px 5px;border-radius:3px;background:#1e1e1e;color:#444;border:1px solid #242424}
.wb-land .lkav{width:14px;height:14px;border-radius:50%;background:#2a2a2a;margin-left:auto}
.wb-land .lproof{background:#060606;border-top:1px solid #111;border-bottom:1px solid #111;padding:18px 40px;display:flex;align-items:center;justify-content:center;gap:36px;flex-wrap:wrap}
.wb-land .lpitem{font-size:13px;color:#444}
.wb-land .lpitem strong{color:#888;font-weight:600}
.wb-land .lpsep{color:#222;font-size:18px;line-height:1}
.wb-land .lsec{padding:100px 40px}
.wb-land .lsec-wrap{max-width:1160px;margin:0 auto}
.wb-land .lsec-label{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#aaa;margin-bottom:14px}
.wb-land .lsec-label-dk{color:#555}
.wb-land .lsec-h{font-family:Georgia,'Times New Roman',Times,serif;font-size:clamp(36px,3.8vw,54px);font-weight:700;letter-spacing:-.03em;line-height:1.1;text-wrap:balance;margin-bottom:56px}
.wb-land .lsec-hiw{background:#000;border-top:1px solid #111}
.wb-land .lsec-hiw .lsec-h{color:#fff;margin-bottom:60px}
.wb-land .lhiw-grid{display:grid;grid-template-columns:repeat(3,1fr);border:1px solid #1a1a1a;border-radius:14px;overflow:hidden}
.wb-land .lhiw-step{padding:36px 32px;border-right:1px solid #1a1a1a}
.wb-land .lhiw-step:last-child{border-right:none}
.wb-land .lhiw-num{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#333;margin-bottom:20px}
.wb-land .lhiw-t{font-size:20px;font-weight:700;letter-spacing:-.02em;color:#fff;margin-bottom:10px}
.wb-land .lhiw-d{font-size:14px;line-height:1.65;color:#555}
.wb-land .lhiw-tag{display:inline-block;margin-top:16px;font-size:11px;color:#3a3a3a;border:1px solid #1e1e1e;padding:4px 10px;border-radius:4px}
.wb-land .lsec-features{background:#f5f5f5;color:#000}
.wb-land .lsec-features .lsec-label{color:#aaa}
.wb-land .lsec-features .lsec-h{color:#000}
.wb-land .lbento{display:grid;grid-template-columns:repeat(12,1fr);gap:10px}
.wb-land .lbc{background:#fff;border:1px solid #e4e4e4;border-radius:14px;padding:28px}
.wb-land .lbc:nth-child(1){grid-column:span 7}
.wb-land .lbc:nth-child(2){grid-column:span 5}
.wb-land .lbc:nth-child(3){grid-column:span 4}
.wb-land .lbc:nth-child(4){grid-column:span 4}
.wb-land .lbc:nth-child(5){grid-column:span 4}
.wb-land .lbc-lbl{font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#ccc;margin-bottom:10px}
.wb-land .lbc-t{font-size:20px;font-weight:700;letter-spacing:-.02em;color:#000;margin-bottom:8px;text-wrap:balance}
.wb-land .lbc-d{font-size:13px;line-height:1.6;color:#888;max-width:380px}
.wb-land .lbc-bullets{list-style:none;margin-top:16px}
.wb-land .lbc-bullets li{font-size:12px;color:#aaa;padding:5px 0;border-bottom:1px solid #f0f0f0;display:flex;align-items:center;gap:8px}
.wb-land .lbc-bullets li:last-child{border-bottom:none}
.wb-land .lbc-bullets li::before{content:'';width:5px;height:5px;border-radius:50%;background:#ddd;flex-shrink:0}
.wb-land .lmk{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px;margin-top:22px;padding:14px;background:#f0f0f0;border-radius:9px}
.wb-land .lmk-h{font-size:9px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#bbb;margin-bottom:5px}
.wb-land .lmk-card{background:#fff;border:1px solid #e5e5e5;border-radius:5px;padding:7px 8px;margin-bottom:4px;font-size:10px;color:#555;line-height:1.35}
.wb-land .lsec-ai{background:#000;border-top:1px solid #111}
.wb-land .lai-grid{display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:center}
.wb-land .lai-h{font-family:Georgia,'Times New Roman',Times,serif;font-size:clamp(34px,3.6vw,50px);font-weight:700;letter-spacing:-.03em;line-height:1.1;color:#fff;text-wrap:balance;margin-bottom:18px}
.wb-land .lai-sub{font-size:15px;line-height:1.7;color:#555;margin-bottom:28px}
.wb-land .lai-pts{list-style:none;border-top:1px solid #111}
.wb-land .lai-pt{display:flex;align-items:flex-start;gap:12px;padding:13px 0;border-bottom:1px solid #111;font-size:13px;color:#666}
.wb-land .lai-pt strong{color:#aaa;font-weight:500}
.wb-land .lai-check{width:16px;height:16px;border:1px solid #2a2a2a;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;color:#444;font-size:9px}
.wb-land .lchat-mock{background:#0d0d0d;border:1px solid #1e1e1e;border-radius:14px;overflow:hidden}
.wb-land .lchat-hd{background:#111;border-bottom:1px solid #1a1a1a;padding:11px 16px;display:flex;align-items:center;gap:9px}
.wb-land .lchat-av{width:28px;height:28px;border-radius:7px;background:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#000;flex-shrink:0}
.wb-land .lchat-nm{font-size:12px;font-weight:600;color:#ddd}
.wb-land .lchat-st{font-size:10px;color:#444}
.wb-land .lchat-bd{padding:16px;display:flex;flex-direction:column;gap:11px;min-height:260px}
.wb-land .lmsg{display:flex;gap:8px}
.wb-land .lmsg-u{flex-direction:row-reverse}
.wb-land .lbubble{max-width:78%;font-size:12px;line-height:1.5;padding:9px 13px;border-radius:11px}
.wb-land .lbubble-ai{background:#1a1a1a;border:1px solid #242424;color:#ccc;border-bottom-left-radius:3px}
.wb-land .lbubble-u{background:#fff;color:#000;border-bottom-right-radius:3px}
.wb-land .lmavt{width:22px;height:22px;border-radius:6px;flex-shrink:0;margin-top:2px}
.wb-land .lmavt-ai{background:#fff;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:900;color:#000}
.wb-land .lmavt-u{background:#222;border-radius:50%}
.wb-land .lchat-inp{margin:0 16px 16px;background:#161616;border:1px solid #222;border-radius:8px;padding:10px 14px;display:flex;align-items:center;justify-content:space-between}
.wb-land .lchat-ph{font-size:11px;color:#3a3a3a}
.wb-land .lchat-snd{width:22px;height:22px;border-radius:5px;background:#222;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.wb-land .larrow{width:0;height:0;border-style:solid;border-width:4px 0 4px 6px;border-color:transparent transparent transparent #555;margin-left:2px}
.wb-land .lsec-mods{background:#fff;border-top:1px solid #eee}
.wb-land .lsec-mods .lsec-label{color:#ccc}
.wb-land .lsec-mods .lsec-h{color:#000}
.wb-land .lmods-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#e8e8e8;border:1px solid #e8e8e8;border-radius:14px;overflow:hidden}
.wb-land .lmod{background:#fff;padding:26px 22px}
.wb-land .lmod-ico{font-size:13px;font-weight:700;color:#ccc;margin-bottom:10px;letter-spacing:.05em}
.wb-land .lmod-t{font-size:14px;font-weight:700;color:#000;margin-bottom:6px;letter-spacing:-.01em}
.wb-land .lmod-d{font-size:12px;line-height:1.55;color:#999}
.wb-land .lsec-uc{background:#000;border-top:1px solid #111}
.wb-land .lsec-uc .lsec-h{color:#fff}
.wb-land .luc-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#1a1a1a;border:1px solid #1a1a1a;border-radius:14px;overflow:hidden}
.wb-land .luc-panel{background:#0d0d0d;padding:32px}
.wb-land .luc-tag{display:inline-block;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#444;border:1px solid #222;padding:4px 10px;border-radius:4px;margin-bottom:18px}
.wb-land .luc-h{font-size:18px;font-weight:700;color:#ddd;margin-bottom:10px;letter-spacing:-.01em;line-height:1.25}
.wb-land .luc-d{font-size:13px;color:#555;line-height:1.6;margin-bottom:20px}
.wb-land .luc-list{list-style:none;border-top:1px solid #111}
.wb-land .luc-item{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid #111;font-size:12px;color:#555}
.wb-land .luc-dot{width:4px;height:4px;border-radius:50%;background:#333;flex-shrink:0;margin-top:5px}
.wb-land .lsec-fg{background:#f5f5f5;border-top:1px solid #e5e5e5}
.wb-land .lsec-fg .lsec-label{color:#aaa}
.wb-land .lsec-fg .lsec-h{color:#000;margin-bottom:40px}
.wb-land .lfg{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#e0e0e0;border:1px solid #e0e0e0;border-radius:14px;overflow:hidden}
.wb-land .lfgi{background:#f5f5f5;padding:30px 26px}
.wb-land .lfg-t{font-size:15px;font-weight:700;color:#000;margin-bottom:7px;letter-spacing:-.01em}
.wb-land .lfg-d{font-size:13px;line-height:1.6;color:#999}
.wb-land .lsec-cmp{background:#fff;border-top:1px solid #eee}
.wb-land .lsec-cmp .lsec-label{color:#ccc}
.wb-land .lcmp-wrap{overflow-x:auto}
.wb-land .lcmp-table{width:100%;border-collapse:collapse;min-width:560px}
.wb-land .lcmp-table th{padding:12px 20px;text-align:left;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#bbb;border-bottom:1px solid #eee}
.wb-land .lcmp-table th:first-child{color:#888}
.wb-land .lcmp-col-wb{color:#000!important}
.wb-land .lcmp-table td{padding:14px 20px;font-size:14px;border-bottom:1px solid #f0f0f0;color:#444}
.wb-land .lcmp-table td:first-child{font-weight:500;color:#000}
.wb-land .lcmp-yes{color:#000;font-weight:700}
.wb-land .lcmp-no{color:#ccc}
.wb-land .lcmp-part{color:#aaa}
.wb-land .lcmp-table tr:last-child td{border-bottom:none}
.wb-land .lsec-testi{background:#000;border-top:1px solid #111}
.wb-land .ltg{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:#1a1a1a;border:1px solid #1a1a1a;border-radius:14px;overflow:hidden;margin-top:48px}
.wb-land .lt{background:#0d0d0d;padding:30px}
.wb-land .lt-q{font-size:14px;line-height:1.7;color:#888;margin-bottom:22px;text-wrap:pretty}
.wb-land .lt-q em{font-style:normal;color:#bbb}
.wb-land .lt-au{display:flex;align-items:center;gap:10px}
.wb-land .lt-av{width:30px;height:30px;border-radius:50%;background:#1e1e1e;flex-shrink:0}
.wb-land .lt-nm{font-size:13px;font-weight:600;color:#ccc}
.wb-land .lt-rl{font-size:11px;color:#444}
.wb-land .lsec-cta{background:#fff;border-top:1px solid #e5e5e5;text-align:center}
.wb-land .lcta-h{font-family:Georgia,'Times New Roman',Times,serif;font-size:clamp(40px,5vw,68px);font-weight:700;letter-spacing:-.03em;line-height:1.05;color:#000;text-wrap:balance;margin-bottom:16px}
.wb-land .lcta-sub{font-size:16px;color:#aaa;margin-bottom:40px}
.wb-land .lcta-note{margin-top:16px;font-size:12px;color:#bbb}
.wb-land .lfooter{background:#0b0b0b;border-top:1px solid #111;padding:36px 40px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:20px}
.wb-land .lf-logo{display:flex;align-items:center;gap:8px}
.wb-land .lf-lw{width:24px;height:24px;background:#fff;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;color:#000}
.wb-land .lf-ln{font-size:13px;font-weight:600;color:#444}
.wb-land .lf-copy{font-size:12px;color:#333}
.wb-land .lf-links{display:flex;gap:22px}
.wb-land .lf-lk{text-decoration:none;font-size:13px;color:#444;transition:color .15s}
.wb-land .lf-lk:hover{color:#888}
@media(max-width:960px){
  .wb-land .lhero{grid-template-columns:1fr;gap:48px;min-height:auto;padding:60px 24px}
  .wb-land .lhero-copy{padding-right:0}
  .wb-land .lai-grid{grid-template-columns:1fr;gap:48px}
  .wb-land .lhiw-grid{grid-template-columns:1fr}
  .wb-land .lhiw-step{border-right:none;border-bottom:1px solid #1a1a1a}
  .wb-land .lhiw-step:last-child{border-bottom:none}
  .wb-land .lbc:nth-child(1){grid-column:span 12}
  .wb-land .lbc:nth-child(2){grid-column:span 6}
  .wb-land .lbc:nth-child(3){grid-column:span 4}
  .wb-land .lbc:nth-child(4){grid-column:span 4}
  .wb-land .lbc:nth-child(5){grid-column:span 4}
  .wb-land .lmods-grid{grid-template-columns:repeat(2,1fr)}
  .wb-land .luc-grid{grid-template-columns:1fr}
  .wb-land .lsec{padding:72px 24px}
  .wb-land .lproof{padding:16px 24px;gap:20px}
  .wb-land .lnav{padding:0 20px}
}
@media(max-width:720px){
  .wb-land .lbc:nth-child(n){grid-column:span 12}
  .wb-land .lfg{grid-template-columns:1fr 1fr}
  .wb-land .ltg{grid-template-columns:1fr}
  .wb-land .lm-side{display:none}
  .wb-land .lfooter{flex-direction:column;text-align:center}
  .wb-land .lcmp-table th,.wb-land .lcmp-table td{padding:10px 12px;font-size:12px}
}
@media(max-width:500px){
  .wb-land .lfg{grid-template-columns:1fr}
  .wb-land .lmods-grid{grid-template-columns:1fr 1fr}
  .wb-land .lnav-a:not(.lbtn-nav):not(:last-of-type){display:none}
}
`;

export default function LandingPage() {
  return (
    <>
      <style>{css}</style>
      <div className="wb-land">

        {/* NAV */}
        <nav className="lnav">
          <Link href="/signup" className="lnav-logo">
            <div className="llogo-w">W</div>
            <span className="llogo-name">WorkBox</span>
          </Link>
          <div className="lnav-links">
            <a href="#how" className="lnav-a">How it works</a>
            <a href="#features" className="lnav-a">Features</a>
            <a href="#ai" className="lnav-a">AI</a>
            <Link href="/login" className="lnav-a">Sign in</Link>
            <Link href="/signup" className="lbtn-nav">Start free →</Link>
          </div>
        </nav>

        {/* HERO */}
        <section className="lhero">
          <div className="lhero-copy">
            <span className="leyebrow">All-in-one workspace</span>
            <h1 className="lhero-h1">Work lives<br />here.</h1>
            <p className="lhero-sub">Tasks, documents, goals, CRM, HR, and AI — everything your team needs, finally in one place. No more switching between five tools to get one thing done.</p>
            <div className="lhero-ctas">
              <Link href="/signup" className="lbtn-w">Start for free</Link>
              <a href="#how" className="lbtn-ghost">See how it works</a>
            </div>
            <p className="lhero-note">No credit card required · Free plan available · Ready in 2 minutes</p>
          </div>

          <div>
            <div className="lmockup">
              <div className="lmc">
                <div className="ldot" /><div className="ldot" /><div className="ldot" />
                <div className="lmc-url">app.workbox.io/marketing</div>
              </div>
              <div className="lmb">
                <div className="lm-rail">
                  <div className="lrail-w">W</div>
                  {[true,false,false,false,false,false,false].map((a,i) => (
                    <div key={i} className={`lri${a?" lri-a":""}`}><div className={`lri-ico${a?" lri-ico-a":""}`} /></div>
                  ))}
                </div>
                <div className="lm-side">
                  <div className="lss">Spaces</div>
                  <div className="lsi lsi-a"><div className="lsi-d lsi-d-a" /><span className="lsi-t lsi-t-a">Marketing</span></div>
                  {["Engineering","Design","HR"].map(s=>(
                    <div key={s} className="lsi"><div className="lsi-d" /><span className="lsi-t">{s}</span></div>
                  ))}
                  <div className="lss">Views</div>
                  {["All tasks","My tasks","Calendar"].map(s=>(
                    <div key={s} className="lsi"><div className="lsi-d" /><span className="lsi-t">{s}</span></div>
                  ))}
                  <div className="lss">Documents</div>
                  {["Brand guide","Q3 brief"].map(s=>(
                    <div key={s} className="lsi"><div className="lsi-d" /><span className="lsi-t">{s}</span></div>
                  ))}
                </div>
                <div className="lm-main">
                  <div className="lm-top">
                    <span className="lm-title">Marketing — Sprint 14</span>
                    <span className="lm-badge">Kanban</span>
                  </div>
                  <div className="lkanban">
                    <div>
                      <div className="lkcol-h">To do <span className="lk-n">4</span></div>
                      <div className="lkcard"><div className="lkcard-t">Write Q3 blog posts</div><div className="lkcard-meta"><span className="lktag">Content</span><div className="lkav" /></div></div>
                      <div className="lkcard"><div className="lkcard-t">Update landing page copy</div><div className="lkcard-meta"><span className="lktag">Web</span><div className="lkav" /></div></div>
                    </div>
                    <div>
                      <div className="lkcol-h">In progress <span className="lk-n">3</span></div>
                      <div className="lkcard"><div className="lkcard-t">Email campaign brief</div><div className="lkcard-meta"><span className="lktag">Email</span><div className="lkav" /></div></div>
                      <div className="lkcard"><div className="lkcard-t">Design social assets</div><div className="lkcard-meta"><span className="lktag">Design</span><div className="lkav" /></div></div>
                    </div>
                    <div>
                      <div className="lkcol-h">Done <span className="lk-n">6</span></div>
                      <div className="lkcard"><div className="lkcard-t">Publish case study</div><div className="lkcard-meta"><span className="lktag">Content</span><div className="lkav" /></div></div>
                      <div className="lkcard"><div className="lkcard-t">Review ad performance</div><div className="lkcard-meta"><span className="lktag">Ads</span><div className="lkav" /></div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PROOF STRIP */}
        <div className="lproof">
          <span className="lpitem"><strong>2,000+</strong> teams worldwide</span>
          <span className="lpsep">·</span>
          <span className="lpitem"><strong>50M+</strong> tasks completed</span>
          <span className="lpsep">·</span>
          <span className="lpitem"><strong>12+</strong> modules in one platform</span>
          <span className="lpsep">·</span>
          <span className="lpitem"><strong>50+</strong> integrations</span>
          <span className="lpsep">·</span>
          <span className="lpitem">Free plan available</span>
        </div>

        {/* HOW IT WORKS */}
        <section className="lsec lsec-hiw" id="how">
          <div className="lsec-wrap">
            <div className="lsec-label lsec-label-dk">Getting started</div>
            <h2 className="lsec-h">Up and running<br />before lunch.</h2>
            <div className="lhiw-grid">
              <div className="lhiw-step">
                <div className="lhiw-num">Step 01</div>
                <div className="lhiw-t">Create your workspace</div>
                <div className="lhiw-d">Pick a template built for your team type — engineering, marketing, operations — or start from a blank slate. Your spaces, task lists, and folders are ready in under 2 minutes.</div>
                <span className="lhiw-tag">Pre-built templates included</span>
              </div>
              <div className="lhiw-step">
                <div className="lhiw-num">Step 02</div>
                <div className="lhiw-t">Invite your team</div>
                <div className="lhiw-d">Send an email invite or share a link. Everyone gets their own personalised dashboard — tasks assigned to them, docs they need, goals they own. No training required.</div>
                <span className="lhiw-tag">Unlimited seats on free plan</span>
              </div>
              <div className="lhiw-step">
                <div className="lhiw-num">Step 03</div>
                <div className="lhiw-t">Work the way you want</div>
                <div className="lhiw-d">Switch between List, Kanban, Calendar, or Table view on any space. Connect your calendar, Slack, or GitHub. Let AI surface what needs your attention.</div>
                <span className="lhiw-tag">50+ integrations ready to connect</span>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="lsec lsec-features" id="features">
          <div className="lsec-wrap">
            <div className="lsec-label">Core platform</div>
            <h2 className="lsec-h">Everything your team<br />needs to move fast.</h2>
            <div className="lbento">
              <div className="lbc">
                <div className="lbc-lbl">Tasks &amp; Projects</div>
                <div className="lbc-t">Four views. One source of truth.</div>
                <div className="lbc-d">Manage every task in List, Kanban, Calendar, or Table view — all showing the same data. Assign owners, set priorities, add due dates, and drag between statuses without a single reload.</div>
                <div className="lmk">
                  <div><div className="lmk-h">To do</div><div className="lmk-card">Redesign onboarding flow</div><div className="lmk-card">Write product update email</div></div>
                  <div><div className="lmk-h">In progress</div><div className="lmk-card">Integrate Stripe billing</div><div className="lmk-card">Fix mobile nav bug</div></div>
                  <div><div className="lmk-h">Done</div><div className="lmk-card">Ship v2.3 release</div><div className="lmk-card">Hire frontend engineer</div></div>
                </div>
              </div>
              <div className="lbc">
                <div className="lbc-lbl">Goals &amp; OKRs</div>
                <div className="lbc-t">Connect daily work to what actually matters.</div>
                <div className="lbc-d">Define company, team, and personal objectives. Link tasks directly to key results so progress updates automatically — no manual tracking spreadsheets.</div>
                <ul className="lbc-bullets">
                  <li>Company, team &amp; personal goal levels</li>
                  <li>Automatic progress from linked tasks</li>
                  <li>Visual progress bars and milestone tracking</li>
                  <li>Portfolio view for leadership</li>
                </ul>
              </div>
              <div className="lbc">
                <div className="lbc-lbl">Documents &amp; Drive</div>
                <div className="lbc-t">Your knowledge base</div>
                <div className="lbc-d">Write and share docs with a Google Drive-style file manager. Use built-in templates — meeting notes, project briefs, NDAs, SOPs — or write from scratch in the inline markdown editor.</div>
                <ul className="lbc-bullets">
                  <li>8 document templates built in</li>
                  <li>Share via link with view or edit access</li>
                  <li>Folder navigation and full-text search</li>
                </ul>
              </div>
              <div className="lbc">
                <div className="lbc-lbl">Team Chat</div>
                <div className="lbc-t">Conversations in context</div>
                <div className="lbc-d">Channels, direct messages, and threads — organised by space, project, or topic. Mention tasks directly in chat so the conversation stays connected to the work.</div>
                <ul className="lbc-bullets">
                  <li>Public and private channels</li>
                  <li>Direct and group messages</li>
                  <li>Mention tasks and docs inline</li>
                </ul>
              </div>
              <div className="lbc">
                <div className="lbc-lbl">Integrations</div>
                <div className="lbc-t">Your tools, connected</div>
                <div className="lbc-d">Google Calendar, Outlook, Slack, GitHub, Jira, Stripe, and 50+ more integrations. Sync your calendar, pull in commits, or trigger notifications when tasks change status.</div>
                <ul className="lbc-bullets">
                  <li>Google &amp; Microsoft Calendar sync</li>
                  <li>GitHub &amp; Jira two-way sync</li>
                  <li>Slack &amp; email notifications</li>
                  <li>Zapier &amp; webhook support</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* AI */}
        <section className="lsec lsec-ai" id="ai">
          <div className="lsec-wrap">
            <div className="lai-grid">
              <div>
                <div className="lsec-label lsec-label-dk">AI assistant</div>
                <h2 className="lai-h">An AI that actually knows your workspace.</h2>
                <p className="lai-sub">Most AI tools bolt on as an afterthought. WorkBox&apos;s AI is built into every page — it reads your tasks, docs, goals, and calendar, then helps you act on what it finds.</p>
                <ul className="lai-pts">
                  <li className="lai-pt"><div className="lai-check">✓</div><span><strong>Context-aware on every page</strong> — on Tasks it knows your backlog; on Docs it knows your knowledge base</span></li>
                  <li className="lai-pt"><div className="lai-check">✓</div><span>Ask <em style={{color:"#888"}}>&ldquo;What&apos;s overdue this sprint?&rdquo;</em> and get a real, specific answer</span></li>
                  <li className="lai-pt"><div className="lai-check">✓</div><span><strong>Create tasks, forms, and documents</strong> just by describing what you need</span></li>
                  <li className="lai-pt"><div className="lai-check">✓</div><span>Summarise meeting notes, extract action items, assign them to the right people</span></li>
                  <li className="lai-pt"><div className="lai-check">✓</div><span>Persistent bar always visible — never leave your page to ask it something</span></li>
                  <li className="lai-pt"><div className="lai-check">✓</div><span>Full conversation mode for complex planning and brainstorming</span></li>
                </ul>
              </div>
              <div className="lchat-mock">
                <div className="lchat-hd">
                  <div className="lchat-av">W</div>
                  <div><div className="lchat-nm">WorkBox AI</div><div className="lchat-st">Online · Forms page</div></div>
                </div>
                <div className="lchat-bd">
                  <div className="lmsg">
                    <div className="lmavt lmavt-ai" style={{fontSize:8,fontWeight:900}}>W</div>
                    <div className="lbubble lbubble-ai">You&apos;re on the Forms page. You have <strong style={{color:"#ddd"}}>2 forms collecting responses</strong> and 1 draft. Want me to help you build a new one?</div>
                  </div>
                  <div className="lmsg lmsg-u">
                    <div className="lmavt lmavt-u" />
                    <div className="lbubble lbubble-u">Create a client feedback form with a rating scale and comment box</div>
                  </div>
                  <div className="lmsg">
                    <div className="lmavt lmavt-ai" style={{fontSize:8,fontWeight:900}}>W</div>
                    <div className="lbubble lbubble-ai">Done — <strong style={{color:"#ddd"}}>Client Feedback Form</strong> is ready. I added a 1–5 star rating, an open comment field, and an optional NPS score. Share link is live.</div>
                  </div>
                  <div className="lmsg lmsg-u">
                    <div className="lmavt lmavt-u" />
                    <div className="lbubble lbubble-u">What tasks are overdue across all my spaces?</div>
                  </div>
                  <div className="lmsg">
                    <div className="lmavt lmavt-ai" style={{fontSize:8,fontWeight:900}}>W</div>
                    <div className="lbubble lbubble-ai">You have <strong style={{color:"#ddd"}}>7 overdue tasks</strong>: 3 in Engineering, 2 in Marketing, 2 in HR. Want me to reschedule any?</div>
                  </div>
                </div>
                <div className="lchat-inp">
                  <span className="lchat-ph">Ask anything about your workspace…</span>
                  <div className="lchat-snd"><div className="larrow" /></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* PLATFORM MODULES */}
        <section className="lsec lsec-mods">
          <div className="lsec-wrap">
            <div className="lsec-label">Complete platform</div>
            <h2 className="lsec-h" style={{color:"#000"}}>One subscription.<br />Twelve modules.</h2>
            <div className="lmods-grid">
              {[
                {t:"Tasks & Projects",d:"List, Kanban, Calendar, and Table views. Subtasks, dependencies, and custom statuses."},
                {t:"AI Assistant",d:"Context-aware on every page. Creates tasks, forms, and docs from natural language."},
                {t:"Documents & Drive",d:"Google Drive-style file manager with inline markdown editor, templates, and link sharing."},
                {t:"Team Chat",d:"Channels, DMs, and threads. Mention tasks directly so the conversation stays in context."},
                {t:"Goals & OKRs",d:"Set objectives, link key results to tasks, and watch progress update automatically."},
                {t:"CRM",d:"Track contacts, companies, deals, and pipeline stages without leaving your workspace."},
                {t:"People & HR",d:"Employee records, roles, departments, onboarding checklists, and HR policy documents."},
                {t:"Budget",d:"Log expenses, track project budgets, and see where money is going across the company."},
                {t:"Forms",d:"Build surveys, intake forms, and feedback collectors with 15+ field types. Share via link or QR."},
                {t:"Knowledge Base",d:"Categorised articles, search, and rich-text editing. Your company wiki, always up to date."},
                {t:"Time Tracking",d:"Log hours against tasks, generate timesheets, and report on team capacity by project."},
                {t:"Automations",d:"Trigger actions when tasks move, deadlines pass, or forms are submitted. No code required."},
              ].map(m=>(
                <div key={m.t} className="lmod">
                  <div className="lmod-ico">✓</div>
                  <div className="lmod-t">{m.t}</div>
                  <div className="lmod-d">{m.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* USE CASES */}
        <section className="lsec lsec-uc">
          <div className="lsec-wrap">
            <div className="lsec-label lsec-label-dk">Who uses WorkBox</div>
            <h2 className="lsec-h">Built for every team<br />in your company.</h2>
            <div className="luc-grid">
              <div className="luc-panel">
                <span className="luc-tag">Engineering</span>
                <div className="luc-h">Ship faster with less coordination overhead</div>
                <div className="luc-d">Engineering teams use WorkBox to run sprints, track bugs, manage deployments, and keep everyone aligned — without a separate Jira subscription and three Slack channels.</div>
                <ul className="luc-list">
                  {["Sprint planning boards with story points and burndown","Bug tracker with severity, assignee, and linked PRs","Deployment checklists with sign-off workflows","Tech debt log and architecture docs in one place","GitHub sync: commits and PRs linked to tasks automatically"].map(i=>(
                    <li key={i} className="luc-item"><div className="luc-dot" />{i}</li>
                  ))}
                </ul>
              </div>
              <div className="luc-panel">
                <span className="luc-tag">Marketing</span>
                <div className="luc-h">Run campaigns without losing track of anything</div>
                <div className="luc-d">Marketing teams manage content calendars, campaign pipelines, creative briefs, and launch checklists — all connected to their goals so they can show the work behind every result.</div>
                <ul className="luc-list">
                  {["Content calendar with publish dates and owner per asset","Campaign pipelines from brief to live","AI-generated intake forms for creative briefs","Brand guide and asset library in Documents","Goals tracking: MQLs, pipeline, and content metrics"].map(i=>(
                    <li key={i} className="luc-item"><div className="luc-dot" />{i}</li>
                  ))}
                </ul>
              </div>
              <div className="luc-panel">
                <span className="luc-tag">Operations</span>
                <div className="luc-h">Keep the business running without the chaos</div>
                <div className="luc-d">Operations teams run hiring, vendor management, budget tracking, SOPs, and onboarding — replacing the pile of spreadsheets and shared drives with a single, searchable system.</div>
                <ul className="luc-list">
                  {["Hiring pipeline: job postings, candidates, interview stages","Onboarding checklists that auto-assign to new hires","Budget module: expenses, approvals, and forecasts","SOPs and policy docs in the Knowledge Base","Vendor CRM with contracts and renewal reminders"].map(i=>(
                    <li key={i} className="luc-item"><div className="luc-dot" />{i}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURE GRID */}
        <section className="lsec lsec-fg">
          <div className="lsec-wrap">
            <div className="lsec-label">Also included</div>
            <h2 className="lsec-h">More than a task manager.</h2>
            <div className="lfg">
              {[
                {t:"Meetings",d:"Schedule meetings, attach agendas, log notes, and track action items — all linked to the relevant project."},
                {t:"Workload view",d:"See who is over- or under-assigned across every project. Rebalance tasks without a spreadsheet."},
                {t:"Guest access",d:"Invite clients and contractors with limited access. They see exactly what they need — nothing more."},
                {t:"Portfolio",d:"One view across all your spaces: overall progress, health status, and upcoming milestones."},
                {t:"API & Webhooks",d:"Build custom integrations or connect to any tool. Full REST API with per-user key management."},
                {t:"Activity log",d:"Full audit trail of every change — who did what, when, and on which task or document."},
              ].map(f=>(
                <div key={f.t} className="lfgi">
                  <div className="lfg-t">{f.t}</div>
                  <div className="lfg-d">{f.d}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* COMPARISON */}
        <section className="lsec lsec-cmp">
          <div className="lsec-wrap">
            <div className="lsec-label">Why WorkBox</div>
            <h2 className="lsec-h" style={{color:"#000",marginBottom:40}}>One tool instead of five.</h2>
            <div className="lcmp-wrap">
              <table className="lcmp-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th className="lcmp-col-wb">WorkBox</th>
                    <th>Notion</th>
                    <th>Asana</th>
                    <th>Monday</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Task management","✓","Partial","✓","✓"],
                    ["Built-in AI assistant","✓ Context-aware","Add-on","—","Limited"],
                    ["Documents & knowledge base","✓ Drive + editor","✓","—","—"],
                    ["CRM","✓ Built-in","Template only","—","Add-on"],
                    ["HR & People management","✓ Built-in","—","—","—"],
                    ["Budget tracking","✓ Built-in","—","—","Add-on"],
                    ["Forms & surveys","✓ 15+ field types","—","—","Basic"],
                    ["Free plan","✓ Unlimited seats","✓","Limited","—"],
                  ].map(([feat,...cols])=>(
                    <tr key={feat as string}>
                      <td>{feat}</td>
                      {(cols as string[]).map((v,i)=>(
                        <td key={i} className={v==="—"?"lcmp-no":v.startsWith("✓")&&i===0?"lcmp-yes":v==="✓"?"lcmp-yes":"lcmp-part"}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="lsec lsec-testi">
          <div className="lsec-wrap">
            <div className="lsec-label lsec-label-dk">What teams say</div>
            <div className="ltg">
              <div className="lt">
                <p className="lt-q">&ldquo;We replaced Asana, Notion, and two spreadsheets with WorkBox. Our team actually opens it every day — which is more than I can say for the last three platforms we tried.&rdquo;</p>
                <div className="lt-au"><div className="lt-av" /><div><div className="lt-nm">Sarah M.</div><div className="lt-rl">Head of Operations, Series B startup</div></div></div>
              </div>
              <div className="lt">
                <p className="lt-q">&ldquo;The AI is the part everyone demos to visitors. It saves my team 30 minutes every day answering questions about our backlog that used to require a full standup.&rdquo;</p>
                <div className="lt-au"><div className="lt-av" /><div><div className="lt-nm">James T.</div><div className="lt-rl">Engineering Lead, 40-person product agency</div></div></div>
              </div>
              <div className="lt">
                <p className="lt-q">&ldquo;We set up tasks, docs, HR, and the knowledge base in one afternoon. Onboarding a new hire used to take a day of my time. Now I send them a WorkBox link and they&apos;re self-sufficient by noon.&rdquo;</p>
                <div className="lt-au"><div className="lt-av" /><div><div className="lt-nm">Priya K.</div><div className="lt-rl">CEO, 14-person consulting firm</div></div></div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="lsec lsec-cta">
          <div className="lsec-wrap">
            <h2 className="lcta-h">Your team deserves<br />better tools.</h2>
            <p className="lcta-sub">Set up in under 2 minutes. No credit card. No onboarding calls.</p>
            <Link href="/signup" className="lbtn-dark">Start for free →</Link>
            <p className="lcta-note">Free plan · Unlimited team members · Cancel anytime</p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="lfooter">
          <div className="lf-logo">
            <div className="lf-lw">W</div>
            <span className="lf-ln">WorkBox</span>
          </div>
          <span className="lf-copy">© {new Date().getFullYear()} WorkBox. Built for modern teams.</span>
          <div className="lf-links">
            <Link href="/privacy" className="lf-lk">Privacy</Link>
            <Link href="/login" className="lf-lk">Sign in</Link>
            <Link href="/signup" className="lf-lk">Get started</Link>
          </div>
        </footer>

        <PublicChatWidget />
      </div>
    </>
  );
}
