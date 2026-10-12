# Port Python fidèle de packages/ui/src/themes.ts (luminance, contrast, mix, ensure, resolveTheme)
import json
WHITE="#FFFFFF"
def rgb(h): return [int(h[i:i+2],16) for i in (1,3,5)]
def hx(c): return "#"+"".join(f"{max(0,min(255,round(v))):02X}" for v in c)
def lum(h):
    r,g,b=[v/255 for v in rgb(h)]
    f=lambda v: v/12.92 if v<=0.03928 else ((v+0.055)/1.055)**2.4
    return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b)
def cr(a,b):
    l1,l2=lum(a),lum(b); return (max(l1,l2)+0.05)/(min(l1,l2)+0.05)
def mix(a,b,t): return hx([x+(y-x)*t for x,y in zip(rgb(a),rgb(b))])
def ensure(color,bgs,mn,toward):
    t=0.0
    while t<=1.0001:
        c=mix(color,toward,t)
        if all(cr(c,bg)>=mn for bg in bgs): return c
        t+=0.04
    return toward
def resolve(p):
    c1,c2,c3,c4,c5=p
    ink=ensure(c5,[c1,WHITE],7,"#000000"); text=ink
    muted=ensure(mix(ink,c1,0.28),[c1,WHITE],4.5,ink)
    primary,on=c4,WHITE
    if cr(primary,WHITE)<4.5:
        if cr(primary,ink)>=4.5: on=ink
        else: primary=ensure(c4,[WHITE],4.5,ink)
    ptext=ensure(c4,[c1,WHITE],4.5,ink)
    border=c3 if lum(c2)>0.85 else c2
    bstrong=ensure(mix(ink,WHITE,0.55),[c1,WHITE],3,ink)
    focus=ensure(c4,[c1,WHITE],3,ink)
    return dict(bg=c1,surface=WHITE,surfaceTint=c2,border=border,borderStrong=bstrong,text=text,textMuted=muted,primary=primary,onPrimary=on,primaryText=ptext,focus=focus)
SAUGE_CODE=["#F2F5EF","#D8E2D0","#A9C4A5","#5B7F68","#2C3A33"]
SAUGE_V4  =["#F2F5EF","#D8E2D0","#A9C4A5","#597C66","#2C3A33"]
LAGON     =["#E6FFF7","#B9F2E3","#7AD8C8","#4AA1A3","#2A4B5D"]
if __name__=="__main__":
    for name,p in [("Lagon (défaut actuel)",LAGON),("Sauge — preset actuel (#5B7F68)",SAUGE_CODE),("Sauge — proposé (#597C66)",SAUGE_V4)]:
        r=resolve(p); print("\n##",name)
        for k,v in r.items(): print(f"  {k:12s} {v}")
        print(f"  contraste primary/onPrimary = {cr(r['primary'],r['onPrimary']):.2f}  text/bg = {cr(r['text'],r['bg']):.2f}  muted/bg = {cr(r['textMuted'],r['bg']):.2f}  muted/white = {cr(r['textMuted'],WHITE):.2f}")
        print(f"  primaryText/bg = {cr(r['primaryText'],r['bg']):.2f}  focus/bg = {cr(r['focus'],r['bg']):.2f}  borderStrong/bg = {cr(r['borderStrong'],r['bg']):.2f}")
    print("\n## Valeur brute #5B7F68 / blanc =",round(cr('#5B7F68',WHITE),2)," ; #597C66 / blanc =",round(cr('#597C66',WHITE),2)," ; #597C66 / F2F5EF =",round(cr('#597C66','#F2F5EF'),2))
    print("\n## Statuts fixes (tokens.css) fg/bg")
    for n,fg,bg in [("declared","#8A6100","#FFF3D6"),("measured","#1F4E8C","#E6EEF8"),("verified","#17704A","#E4F5EC"),("contested","#A32D2D","#FBEAE8"),("expired","#4A5550","#E8ECE9")]:
        print(f"  {n:10s} {fg} sur {bg} = {cr(fg,bg):.2f}")
    print("\n## Encre #2C3A33 sur D8E2D0 =",round(cr('#2C3A33','#D8E2D0'),2)," ; accent A9C4A5 vs encre =",round(cr('#A9C4A5','#2C3A33'),2)," ; blanc sur A9C4A5 =",round(cr('#FFFFFF','#A9C4A5'),2))
    print("## Logo : sauge 597C66 sur F2F5EF =",round(cr('#597C66','#F2F5EF'),2)," ; encre sur 597C66 =",round(cr('#2C3A33','#597C66'),2)," ; F2F5EF sur 597C66 =",round(cr('#F2F5EF','#597C66'),2))
