#!/usr/bin/env python3
"""Author original SVG ink illustrations, rasterized to true transparent RGBA.

No crop feather, screenshot extraction, opaque paper/matte, or canvas-edge paint.
Paper grain belongs to the HTML/CSS page, never the illustration.
Uses CairoSVG for local art authoring; checked-in PNGs need no runtime dependency.
"""
from pathlib import Path
import math
import random
import io
from PIL import Image
import cairosvg

DEST=Path(__file__).resolve().parents[1]/'frontend/public/art/inkbound'
DEST.mkdir(parents=True,exist_ok=True)
R=random.Random(651)

class Sketch:
 def __init__(self,w=1200,h=520):
  self.w,self.h=w,h
  self.s=[f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">']
 def path(self,d,stroke='#292725',width=1,fill='none',opacity=1,extra=''):
  self.s.append(f'<path d="{d}" stroke="{stroke}" stroke-width="{width}" fill="{fill}" opacity="{opacity}" stroke-linejoin="round" stroke-linecap="round" {extra}/>' )
 def circle(self,x,y,r,color='#36322e',opacity=.8):
  self.s.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}" fill="{color}" opacity="{opacity:.3f}"/>')
 def ellipse(self,x,y,rx,ry,opacity=.2):
  self.s.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#4b4641" opacity="{opacity}"/>')
 def finish(self,name,w=1400):
  self.s.append('</svg>')
  png=cairosvg.svg2png(bytestring=''.join(self.s).encode(),output_width=w,output_height=round(w*self.h/self.w))
  im=Image.open(io.BytesIO(png)).convert('RGBA')
  # MUST have a generous literal transparent safe margin around all four sides.
  alpha=im.getchannel('A')
  bbox=alpha.getbbox(); ww,hh=im.size
  assert bbox is not None
  assert bbox[0]>=.09*ww and bbox[1]>=.09*hh and bbox[2]<=.91*ww and bbox[3]<=.91*hh,(name,bbox,im.size)
  # Every edge pixel must be fully transparent; no generated paper or crop taper.
  for edge in (alpha.crop((0,0,ww,2)),alpha.crop((0,hh-2,ww,hh)),alpha.crop((0,0,2,hh)),alpha.crop((ww-2,0,ww,hh))):
   assert edge.getextrema()==(0,0)
  output=DEST/name;im.save(output,optimize=True)
  print(name,im.size,bbox,output.stat().st_size)

def stipple(s,clusters,n=650):
 for _ in range(n):
  cx,cy,rx,ry=R.choice(clusters)
  x=R.gauss(cx,rx*.4);y=R.gauss(cy,ry*.4)
  if 155<x<1035 and 72<y<445 and ((x-cx)/rx)**2+((y-cy)/ry)**2<1.1:
   s.circle(x,y,R.choice([.32,.55,.74,1.1,1.7]),opacity=R.uniform(.12,.68))

def landscape(name,variant=0):
 s=Sketch()
 # Cloud and watercolor light values are isolated shapes, never a paper rectangle.
 for x,y,rx,ry in [(505,174,94,26),(636,142,88,19),(860,184,66,23),(575,207,140,37)]:
  for i in range(7):
   s.ellipse(x+R.randint(-rx//2,rx//2),y+R.randint(-15,15),rx*.46,ry*.8,opacity=.009 + .006*i)
 # Distant mountains, hairline contour work.
 for peaks,y,op in [([(160,280),(205,230),(239,252),(300,171),(347,238),(388,215),(454,275),(519,234),(582,276),(615,211),(677,265),(724,236),(782,288),(860,225),(937,271),(1005,257),(1037,300)],350,.10),
                    ([(185,350),(247,289),(301,336),(373,236),(423,293),(478,277),(512,333),(603,258),(675,315),(723,282),(775,317),(831,250),(914,323),(1014,318)],386,.10)]:
  # Irregular painted ridge, never a rectangular wash ending on a horizontal cut.
  ridge=[peaks[0]]
  for (xa,ya),(xb,yb) in zip(peaks,peaks[1:]):
   for frac in (.24,.48,.72):
    ridge.append((round(xa+(xb-xa)*frac,1),round(ya+(yb-ya)*frac+R.uniform(-11,11),1)))
   ridge.append((xb,yb))
  bottom=[(x,round(y+R.uniform(-24,17),1)) for x in range(peaks[-1][0],peaks[0][0]-1,-18)]
  d='M '+' L '.join(f'{x} {yy}' for x,yy in ridge)+' L '+' L '.join(f'{x} {yy}' for x,yy in bottom)+' Z'
  s.path(d,stroke='none',fill='#373839',opacity=op)
  s.path('M '+' L '.join(f'{x} {yy}' for x,yy in ridge),stroke='#4c4b47',width=1.4,opacity=op*3)
 # Sketched hatching on mountain faces
 for _ in range(190):
  x=R.uniform(205,1006); y=R.uniform(241,344);length=R.uniform(2,20)
  s.path(f'M {x:.1f} {y:.1f} l {-length/2:.1f} {length:.1f}',stroke='#45403d',width=R.uniform(.28,1),opacity=R.uniform(.04,.19))
 # A ruined castle, pen strokes. Hold architecture clearly separate from the mountains.
 for x,y,w,h in [(748,171,27,142),(783,210,44,96),(837,158,37,161),(884,211,30,110),(920,194,21,126)]:
  color='#302f2c'
  s.path(f'M {x} {y+h} L{x} {y+16} L{x+4} {y+16} L{x+4} {y+8} L{x+9} {y+16} L{x+13} {y-9} L{x+17} {y+16} L{x+w-5} {y+14} L{x+w-5} {y+4} L{x+w} {y+16} L{x+w} {y+h} Z',stroke=color,width=1.2,fill=color,opacity=.26)
  for ax in range(x+7,x+w-3,11):
   for ay in range(y+28,y+h-10,22):
    s.path(f'M {ax} {ay+12} l 0 -7 q 4 -8 8 0 l 0 7',stroke='#242320',width=1.6,opacity=.4)
  s.path(f'M {x+2} {y+h} l 0 -{h-7} M{x+w-2} {y+h} l 0 -{h-7}',stroke='#181817',width=1,opacity=.42)
 # Arch bridge across ravine
 for i in range(7):
  x=773+i*27;y=333-i//4*3
  s.path(f'M{x} {y} l 26 0 l0 -11 Q{x+13} {y-41} {x} {y-11} Z',fill='#42403c',stroke='#3d3937',width=1,opacity=.31)
 s.path('M 742 339 Q 881 305 966 332',stroke='#252321',width=5,opacity=.37)
 # River disappears through the gorge
 for i in range(13):
  x=R.randint(570,920); yy=R.randint(347,394)
  s.path(f'M{x} {yy} q{R.randint(7,17)} {R.randint(-4,3)} {R.randint(32,70)} 0',stroke='#484541',width=R.uniform(.5,1.5),opacity=R.uniform(.11,.38))
 # Silhouettes of fir trees at foot of castle
 for i in range(26):
  x=R.randint(633,990);height=R.randint(10,55);y=R.randint(356,406)
  s.path(f'M {x} {y} l 0 -{height} M {x-4} {y-height*.60} l 4 {-height*.26} l 4 {height*.26} M {x-height*.16} {y-height*.22} l{height*.16} {-height*.53} l{height*.16} {height*.53}',stroke='#252622',width=R.uniform(.7,1.7),opacity=R.uniform(.25,.7))
 # Twisted old tree frame on left
 s.path('M 182 400 Q 211 343 196 293 Q 178 252 218 205 Q 241 183 259 132 M 209 303 Q 168 255 178 196 M 215 245 Q 267 216 285 182 M 235 191 Q 213 154 231 102',stroke='#282522',width=11,opacity=.75)
 for d in ['M 204 274 Q 158 242 148 213','M 226 228 Q 270 196 328 199','M 220 228 Q 238 187 280 163','M 194 276 Q 175 264 166 249','M 222 238 Q 287 212 306 220','M 224 190 Q 245 153 259 125']:
  s.path(d,stroke='#282522',width=R.uniform(2,4.5),opacity=.7)
 for _ in range(170):
  x=R.gauss(228,48);y=R.gauss(174,49)
  if 148<x<344 and 75<y<282:
   s.path(f'M{x:.1f} {y:.1f} l{R.uniform(-9,9):.1f} {R.uniform(-3,3):.1f}',stroke='#282724',width=R.uniform(.5,3.2),opacity=R.uniform(.24,.7))
 # Rocky foreground ledge, broken linear edges
 s.path('M 197 416 Q 234 392 284 405 L 323 394 L 358 408 L 434 394 L 496 411 L 550 402 L 603 422 L 654 426',stroke='#242321',width=5,opacity=.68)
 for _ in range(230):
  x=R.uniform(210,650);y=R.uniform(402,439)
  if y<410 and R.random()<.7:continue
  length=R.uniform(3,25)
  s.path(f'M{x:.1f} {y:.1f} l {length:.1f} {R.uniform(-3,5):.1f}',stroke='#292622',width=R.uniform(.4,2.8),opacity=R.uniform(.1,.55))
 # Standing cloaked adventurer; sword and trailing cloak
 s.path('M 377 323 Q 363 304 370 287 Q 386 272 394 283 L 401 302 L 396 318 Z',fill='#22221f',opacity=.92)
 s.path('M 369 314 Q 344 331 327 368 L 359 360 L 336 397 L 364 380 L 372 398 L 394 386 L 410 403 L 409 354 L 401 320 Z',stroke='#22221f',width=2.5,fill='#2a2926',opacity=.85)
 s.path('M 373 378 L 361 416 L 375 417 L 390 386 L 396 418 L 413 418 L 408 373',stroke='#171715',width=8,opacity=.95)
 s.path('M 399 329 Q 422 355 430 387 M 399 342 L 418 345',stroke='#1c1a18',width=7)
 s.path('M 410 391 L 435 291 L 429 289 L 412 388 M 430 289 l 3 -15',stroke='#181717',width=2.8)
 # Sitting companion, folded cloak
 s.path('M 488 367 Q 487 349 498 343 Q 515 340 523 353 L 524 371 Z',stroke='#21211f',width=2,fill='#292826',opacity=.9)
 s.path('M 489 370 Q 464 387 452 412 L 484 412 L 513 401 L 542 420 L 573 423 L 534 397 L 518 367 Z',stroke='#262421',width=2,fill='#2b2926',opacity=.77)
 s.path('M 511 399 Q 533 391 547 408 L 568 415 M 508 394 L 529 426',stroke='#1a1917',width=3)
 for x,y in [(386,309),(386,353),(359,370),(385,389),(499,360),(489,389)]:
  for k in range(6):
   s.path(f'M {x+R.randint(-8,8)} {y+R.randint(-9,9)} l {R.randint(-12,12)} {R.randint(3,14)}',stroke='#f2eee4',width=.7,opacity=.19)
 stipple(s,[(269,411,130,34),(459,417,125,24),(830,338,158,65),(231,201,115,95),(553,290,120,78)],850)
 s.finish(name)

def feature(name,subject):
 s=Sketch(420,420)
 # Ink objects live in center 120..305 x 115..315. Intentional blank canvas around.
 if subject=='signpost':
  s.path('M 209 322 Q 204 259 210 165 L 223 164 L 220 322 Z',fill='#31302d',width=2,opacity=.76)
  for i,(yy,sign) in enumerate([(163,1),(198,-1),(233,1)]):
   if sign==1:d=f'M 161 {yy} L 267 {yy-8} L 281 {yy+4} L 263 {yy+17} L 163 {yy+24} Z'
   else:d=f'M 174 {yy} L 274 {yy-9} L 282 {yy+14} L 170 {yy+22} L 155 {yy+12} Z'
   s.path(d,fill='#77716a',width=2,opacity=.32)
   s.path(d,width=2,opacity=.72)
   for j in range(7):s.path(f'M{178+j*12} {yy+R.randint(3,13)} l{R.randint(3,8)} 1',opacity=.42)
 elif subject=='lantern':
  s.path('M 159 285 l 1 -100 l 12 -22 l 35 0 l 13 22 l 0 100 Z',stroke='#292825',width=4)
  s.path('M 179 162 l 0 -14 q 13 -17 21 0 l0 14 M 159 187 L 220 187 M 168 274 L 209 274 M 172 189 L 173 263 L 210 263 L 210 190',stroke='#34312e',width=2.8)
  s.path('M 183 252 Q 172 227 188 207 Q 190 222 195 230 Q 197 207 206 220 Q 215 248 195 254 Z',fill='#4c4541',opacity=.20)
  s.path('M 131 300 l 75 -22 l 73 14 l -76 24 Z M 141 285 l 69 -20 l 49 13 l-63 20 Z',stroke='#292621',width=2.3,fill='#4a4540',opacity=.4)
 elif subject=='cups':
  for x,y in [(153,232),(221,242)]:
   s.path(f'M {x} {y} q 40 -9 69 0 l -9 46 q -28 15 -47 -2 Z',stroke='#2b2926',width=3,fill='#45403b',opacity=.35)
   s.path(f'M {x+67} {y+7} q 32 -14 31 5 q -5 24 -34 23',stroke='#292522',width=3)
   for i in range(4):s.path(f'M {x+10+i*9} {y-12} q{R.randint(-9,9)} -11 1 -26',stroke='#484541',width=1,opacity=.36)
  s.path('M 151 312 Q 216 298 308 315',stroke='#2b2925',width=2)
 stipple(s,[(214,314,109,20),(194,206,92,57)],200)
 s.finish(name,w=430)

landscape('north-road.png')
landscape('hero-vista.png')
landscape('vista-original.png')
feature('signpost.png','signpost')
feature('lantern-books.png','lantern')
feature('camp-cups.png','cups')
