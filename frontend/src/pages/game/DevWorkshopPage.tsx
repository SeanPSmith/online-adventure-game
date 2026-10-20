import { Link } from "react-router";

const LABS = [
  { path: "visual-playground", name: "Blank Book", summary: "Approved scene, physical book, top menu" },
  { path: "ink-lab", name: "Ink Laboratory", summary: "Mask decoding, poetic transitions and replay" },
  { path: "inkspace-story", name: "Manuscript Composition", summary: "Illuminated writing and transparent watercolor art" },
  { path: "inkspace-reader", name: "Paginated Reader", summary: "Long story, pagination and attached journal" },
  { path: "tabletop-kit", name: "Floating Instruments", summary: "Character, chat and notes interaction prototype" },
  { path: "space-lab", name: "Cosmetic Space Lab", summary: "Scene composition, margins, lighting, and anchors" },
  { path: "home-lab", name: "Authenticated Home", summary: "Real Heroes and adventures, safely isolated" },
] as const;

/** Deliberately a practical developer index, not another faux production page. */
export function DevWorkshopPage() {
  return <main id="dev-workshop" style={{minHeight:"100dvh",background:"#1c1715",color:"#f6e9d3",fontFamily:"Georgia,serif",padding:"clamp(24px,4vw,64px)"}}>
    <div style={{maxWidth:900,margin:"0 auto"}}>
      <p style={{letterSpacing:".2em",fontSize:12,color:"#c2a77e"}}>TALES OF TWO / DEVELOPMENT ONLY</p>
      <h1 style={{fontSize:"clamp(30px,5vw,48px)",margin:"12px 0"}}>Living Book Workshop</h1>
      <p style={{lineHeight:1.6}}>These experiments are isolated from player-facing navigation. Keep the current game working while validating visual parity and interactions.</p>
      <p><Link style={{color:"#f5d18e"}} to="/game">← Return to the real game</Link></p>
      <nav aria-label="Development playgrounds" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,250px),1fr))",gap:14,marginTop:28}}>
        {LABS.map((lab) => <Link key={lab.path} to={`/dev/${lab.path}`} style={{display:"block",color:"inherit",textDecoration:"none",padding:20,border:"1px solid #765b3a",background:"#30241d",borderRadius:6}}>
          <strong style={{display:"block",fontSize:20}}>{lab.name}</strong>
          <span style={{display:"block",fontSize:14,marginTop:10,lineHeight:1.5,color:"#d0c0a9"}}>{lab.summary}</span>
        </Link>)}
      </nav>
      <p style={{fontSize:13,color:"#c2a77e",marginTop:32}}>Private experiments only. Avoid putting /dev pages in public navigation, analytics funnels, or marketing links.</p>
    </div>
  </main>;
}
