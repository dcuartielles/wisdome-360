from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.transformPen import TransformPen
import sys
F='/mnt/user-data/uploads/10 - Wisdome 360 projection/outputs/06-examples/EX-09-type-size/fonts/'
bold=TTFont(F+'Poppins-Bold.ttf'); reg=TTFont(F+'Poppins-Regular.ttf')
INK='#1d3557'; AMB='#D0862A'
def glyph(font, ch):
    gs=font.getGlyphSet(); name=font.getBestCmap()[ord(ch)]; return gs[name], gs[name].width
def run(font, text, x0, size, skip_o=False, track=0):
    """Return (paths, o_box, end_x). Coordinates: y down, baseline at 0."""
    upm=font['head'].unitsPerEm; s=size/upm; x=x0; d=[]; obox=None
    for ch in text:
        g,w=glyph(font,ch)
        if skip_o and ch=='o':
            bp=BoundsPen(font.getGlyphSet()); g.draw(bp); b=bp.bounds
            obox=(x+b[0]*s, -b[3]*s, x+b[2]*s, -b[1]*s)
        else:
            pen=SVGPathPen(font.getGlyphSet()); tp=TransformPen(pen,(s,0,0,-s,x,0)); g.draw(tp); d.append(pen.getCommands())
        x+=w*s+track
    return ' '.join(d), obox, x
def stem(font,size):
    # vertical stem thickness of 'l'
    bp=BoundsPen(font.getGlyphSet()); g,_=glyph(font,'l'); g.draw(bp); b=bp.bounds
    return (b[2]-b[0])*size/font['head'].unitsPerEm
def o_mark(box, sw, ink, amb):
    x0,y0,x1,y1=box; cx=(x0+x1)/2; cy=(y0+y1)/2; r=min(x1-x0,y1-y0)/2 - sw/2
    dot=r*0.28; dy=r*0.27
    return (f'<circle cx="{cx:.2f}" cy="{cy:.2f}" r="{r:.2f}" fill="none" stroke="{ink}" stroke-width="{sw:.2f}"/>'
            f'<circle cx="{cx:.2f}" cy="{cy+dy:.2f}" r="{dot:.2f}" fill="{amb}"/>'), (cx,cy,r)
def wordmark(ink, amb, stacked=False, with360=True):
    size=100; sw=stem(bold,size)*0.74
    p1,obox,end=run(bold,'wisdome',0,size,skip_o=True,track=-1)
    om,_=o_mark(obox,sw,ink,amb)
    parts=[f'<path d="{p1}" fill="{ink}"/>',om]
    asc=-73; desc=2  # approx x/ascender in px for Poppins at 100
    if with360:
        if stacked:
            p2,_,e2=run(reg,'360',0,size*0.62,track=4)
            parts.append(f'<path d="{p2}" fill="{ink}" transform="translate({end-e2:.1f},62)"/>')
            vb=(-4,-80,end+8,152)
        else:
            p2,_,e2=run(reg,'360',end+18,size,track=0)
            parts.append(f'<path d="{p2}" fill="{ink}" opacity="0.62"/>')
            end=e2; vb=(-4,-80,end+8,96)
    else:
        vb=(-4,-80,end+8,96)
    return vb, ''.join(parts)
def svg(vb, body, title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[0]} {vb[1]} {vb[2]:.1f} {vb[3]}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>\n'
def mark(ink, amb, bg=None, pad=0.12):
    # the dome-master o alone, square
    S=100; sw=9; r=(S/2)*(1-pad)-sw/2; cx=cy=S/2
    body=(f'<rect width="{S}" height="{S}" rx="22" fill="{bg}"/>' if bg else '')
    body+=f'<circle cx="{cx}" cy="{cy}" r="{r:.2f}" fill="none" stroke="{ink}" stroke-width="{sw}"/><circle cx="{cx}" cy="{cy+r*0.27:.2f}" r="{r*0.26:.2f}" fill="{amb}"/>'
    return svg((0,0,S,S), body, 'Wisdome 360')
out={}
vb,b=wordmark(INK,AMB); out['wisdome360-wordmark.svg']=svg(vb,b,'wisdome 360')
vb,b=wordmark('#ffffff',AMB); out['wisdome360-wordmark-white.svg']=svg(vb,b,'wisdome 360')
vb,b=wordmark(INK,AMB,stacked=True); out['wisdome360-wordmark-stacked.svg']=svg(vb,b,'wisdome 360')
vb,b=wordmark('#ffffff',AMB,stacked=True); out['wisdome360-wordmark-stacked-white.svg']=svg(vb,b,'wisdome 360')
out['wisdome360-mark.svg']=mark(INK,AMB)
out['wisdome360-mark-white.svg']=mark('#ffffff',AMB)
out['favicon.svg']=mark('#ffffff',AMB,bg=INK,pad=0.2)
import os; os.makedirs('out',exist_ok=True)
for k,v in out.items(): open('out/'+k,'w').write(v)
print(list(out))
