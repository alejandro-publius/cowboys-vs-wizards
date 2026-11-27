"""The Showdown court. Original sprite art on a 240 x 134 integer pixel plane."""
from collections import defaultdict
from functools import lru_cache
import random

from PIL import Image, ImageDraw


def _paint():
    w, h = 240, 134
    image = Image.new("RGB", (w, h), "#63526a")
    draw = ImageDraw.Draw(image)
    rng = random.Random(710209)

    def poly(points, fill, edge=None):
        draw.polygon(points, fill=fill, outline=edge)

    def rect(x, y, x2, y2, fill):
        draw.rectangle((x, y, x2, y2), fill=fill)

    def line(points, fill, width=1):
        draw.line(points, fill=fill, width=width)

    def dot(x, y, c):
        draw.point((x, y), fill=c)

    def sprite(rows, colors, x, y):
        for j, row in enumerate(rows):
            for i, value in enumerate(row):
                if value in colors:
                    dot(x+i, y+j, colors[value])

    # One axonometric ground plane. u runs up the street, v runs across it.
    def iso(u, v, z=0):
        return round(24+u+v), round(86+(v-u)/2-z)

    def face(coords, fill, edge=None):
        poly([iso(*p) for p in coords], fill, edge)

    def beam(a, b, color, width=1):
        line([iso(*a), iso(*b)], color, width)

    def tile(u, v, a, b, z, fill, edge=None):
        face([(u,v,z), (a,v,z), (a,b,z), (u,b,z)], fill, edge)

    def block(u,v,a,b,z,zt,top,west,east):
        face([(u,v,z),(a,v,z),(a,v,zt),(u,v,zt)],west)
        face([(u,b,z),(a,b,z),(a,b,zt),(u,b,zt)],east)
        face([(u,v,z),(u,b,z),(u,b,zt),(u,v,zt)],west)
        tile(u,v,a,b,zt,top)

    # Sandstone high country. Distant banks lean lavender; the lower street
    # catches peach light. Each fleck is a pixel of pigment on its own plane.
    poly([(0,0),(240,0),(240,134),(0,134)], "#9f7272")
    face([(-110,-110,0),(150,-110,0),(150,-34,0),(-110,-34,0)],"#60556b")
    face([(-110,-37,0),(155,-37,0),(156,-25,0),(-110,-25,0)],"#a07778")
    for _ in range(1900):
        x,y=rng.randrange(w),rng.randrange(h)
        base=image.getpixel((x,y))
        tones={(159,114,114):("#ae827b","#986b6e","#b98b80"),
               (96,85,107):("#6f6173","#70616e","#564f65"),
               (160,119,120):("#aa8080","#927279")}
        if base in tones:
            dot(x,y,rng.choice(tones[base]))

    # Purple tributary and the dark lip of a miniature mesa northwest of town.
    poly([(0,13),(21,5),(32,6),(50,0),(65,0),(37,12),(20,13),(0,23)],"#4b405e")
    poly([(0,15),(24,7),(34,8),(52,0),(58,0),(37,10),(22,11),(0,20)],"#536d83")
    for pts in [[(0,17),(15,12),(18,12)],[(25,8),(32,8)],[(41,6),(50,2)]]:
        line(pts,"#76909a")
    def outcrop(x,y,scale):
        contour=[(-14,0),(-13,-5),(-9,-6),(-7,-11),(-1,-12),(1,-14),(7,-13),(10,-7),(14,-6),(16,-2),(11,2),(2,5),(-6,4)]
        points=[(x+round(a*scale),y+round(b*scale)) for a,b in contour]
        poly(points,"#4e415b")
        for coords, c in [([(-13,-4),(-9,-6),(-7,-11),(-1,-12),(1,-14),(7,-13),(9,-9),(2,-7),(0,-5),(-6,-5),(-7,-2)],"#c58578"),
                           ([(-11,-3),(-7,-5),(-6,-8),(2,-9),(3,-11),(8,-11),(9,-8),(3,-6),(2,-3),(-4,-2),(-5,2),(-8,2)],"#9d626c"),
                           ([(3,-6),(10,-8),(11,-5),(15,-5),(16,-2),(9,1),(3,2),(5,-1)],"#77526b")]:
            poly([(x+round(a*scale),y+round(b*scale)) for a,b in coords],c)
    for x,y,s in [(82,4,.9),(65,8,.56),(5,6,1.1),(14,1,.7),(42,20,.7),(13,33,.55),(126,0,1.1)]:
        outcrop(x,y,s)

    def cactus(x,y,s=1):
        sh="#4b4656"; mid="#537468"; hi="#8f9d79"
        line([(x,y),(x+5*s,y+2*s)],"#876871",s+1)
        line([(x,y),(x,y-10*s)],sh,2*s+1)
        line([(x,y-4*s),(x-4*s,y-6*s),(x-4*s,y-9*s)],sh,2*s)
        line([(x,y-2*s),(x+3*s,y-4*s),(x+3*s,y-7*s)],sh,2*s)
        line([(x-1,y-1),(x-1,y-10*s)],mid,s)
        line([(x-4*s,y-8*s),(x-4*s,y-6*s),(x-1,y-4*s)],mid,s)
        dot(x-1,y-10*s,hi); dot(x-4*s,y-9*s,hi)
    for tree in [(19,33,1),(53,16,1),(102,7,1),(8,48,1),(93,17,1),(123,7,1)]:
        cactus(*tree)

    def cottonwood(x,y,size):
        # Clumps have a lit upper-left face and a cool, jagged underside.
        poly([(x-2,y),(x+1,y-2),(x+10,y),(x+8,y+2)],"#795e68")
        line([(x,y),(x-1,y-7),(x+1,y-12)],"#4c3e4e",2)
        line([(x,y-3),(x+3,y-8),(x+5,y-9)],"#7b5b5a")
        for dx,dy,sc in [(2,-6,.68),(-3,-7,.85),(1,-11,.95),(4,-8,.65),(-1,-8,.88)]:
            r=max(2,round(size*sc))
            xx=x+dx; yy=y+dy
            poly([(xx-r,yy-1),(xx-r+1,yy-r+1),(xx-1,yy-r-1),(xx+2,yy-r),
                  (xx+r,yy-2),(xx+r,yy+1),(xx+r-2,yy+3),(xx-2,yy+3),(xx-r,yy+1)],"#42565b")
            poly([(xx-r,yy-1),(xx-r+1,yy-r+1),(xx-1,yy-r),(xx+2,yy-r),
                  (xx+r-1,yy-2),(xx+1,yy),(xx-2,yy-1),(xx-3,yy+1)],"#778976")
            for ddx,ddy in ((-2,-2),(0,-3),(-1,-4)):
                dot(xx+ddx,yy+ddy,"#abb18a")
    for x,y,r in [(0,32,5),(28,13,5),(44,10,4),(77,7,4),(103,3,5),(8,53,4)]:
        cottonwood(x,y,r)
    # Western water tank at the back of the grandstand.
    def water_tank(x,y):
        for dx,dy in ((-5,-1),(3,0),(7,-2)):
            line([(x+dx,y+dy),(x+dx+1,y-11+dy)],"#514757",2)
        line([(x-4,y-2),(x+3,y-9)],"#9d7d74")
        line([(x-4,y-9),(x+3,y-2)],"#725b65")
        poly([(x-7,y-18),(x+1,y-20),(x+8,y-17),(x+8,y-10),
              (x+2,y-8),(x-5,y-10),(x-7,y-12)],"#5c5664")
        poly([(x-7,y-17),(x-2,y-16),(x+2,y-16),(x+2,y-9),(x-5,y-11),(x-7,y-12)],"#b18875")
        for dx in (-5,-2,1,4,7):
            line([(x+dx,y-16),(x+dx,y-12)],"#88706f")
        line([(x-6,y-14),(x+1,y-12),(x+7,y-14)],"#5d5460")
        poly([(x-8,y-18),(x,y-22),(x+8,y-18),(x+7,y-16),(x,y-15),(x-6,y-16)],"#585969")
        line([(x-7,y-18),(x,y-21),(x+6,y-18)],"#c6a38e")
        line([(x+4,y-15),(x+4,y+1)],"#c4a084")
        line([(x+6,y-16),(x+6,y)],"#816c70")
        for yy in range(y-13,y,3):
            line([(x+4,yy),(x+6,yy-1)],"#ac8c7d")
    water_tank(51,30)
    # Stone apron, retaining wall and timber lip of the former cattle auction ring.
    tile(-13,-10,143,79,0,"#5e4d5e")
    tile(-12,-9,141,78,1,"#d0a089")
    tile(-10,-8,139,76,1,"#bb8c7f")
    for u in range(-10,140,6):
        beam((u,66,1),(u,76,1),"#a77f79")
    for v in range(-5,77,6):
        beam((-12,v,1),(0,v,1),"#ac817b")
    for u in range(0,139,8):
        beam((u,68,1),(u+4,68,1),"#dfb595")
    block(-2,-2,128,64,0,2,"#f0b276","#624551","#835256")
    tile(0,0,126,62,2,"#b96a50")
    tile(2,2,124,60,2,"#cf805b")
    # Broken bands of red clay, warm chalk and low sun on the grain.
    for _ in range(2300):
        u,v=rng.uniform(2,123),rng.uniform(2,59)
        x,y=iso(u,v,2)
        c=rng.choice(("#c37959","#db8e64","#c47453","#d98a60","#dc976a","#d18460"))
        dot(x,y,c)
        if rng.random()<.16: dot(x+1,y,c)
    def chalk(u,v,a,b,color):
        beam((u,v,2),(a,b,2),color)
    for coords in [(8,8,118,8),(118,8,118,54),(118,54,8,54),(8,54,8,8)]:
        chalk(*coords,"#f4c68b")
    for u in (22,105):
        chalk(u,10,u,52,"#eab482")
        for v in (13,49):
            chalk(u-2,v,u+2,v,"#f6cc96")
    # A set of paired duel slots, painted rather than drawn over the players.
    for u,v in ((42,20),(42,40),(78,20),(78,40)):
        for a,b,c,d in [(0,0,8,0),(8,0,8,6),(8,6,0,6),(0,6,0,0)]:
            chalk(u+a,v+b,u+c,v+d,"#b56e54")
    # Court's neutral brass medallion and its two facing arrows.
    cx,cy=iso(63,31,2)
    poly([(cx-8,cy),(cx,cy-4),(cx+8,cy),(cx,cy+4)],"#8b5750")
    poly([(cx-6,cy),(cx,cy-3),(cx+6,cy),(cx,cy+3)],"#edb47d")
    poly([(cx-3,cy),(cx,cy-2),(cx+3,cy),(cx,cy+2)],"#77505a")
    dot(cx,cy,"#f9d89a")
    for u in (28,34,90,96):
        x,y=iso(u,31,2)
        line([(x-1,y),(x+1,y-1)],"#f2bc86")

    def railing(u0,v0,u1,v1,z,height,posts,light="#cb9878"):
        for f in (.35,.74):
            beam((u0,v0,z+round(height*f)),(u1,v1,z+round(height*f)),"#5e454c",2)
            beam((u0,v0,z+round(height*f)+1),(u1,v1,z+round(height*f)+1),light)
        for i in range(posts):
            t=i/(posts-1)
            u=u0+(u1-u0)*t; v=v0+(v1-v0)*t
            beam((u,v,z),(u,v,z+height),"#4d3c4c",2)
            beam((u,v,z+2),(u,v,z+height),light)
            x,y=iso(u,v,z+height)
            dot(x,y-1,"#e5b58e")

    # Saloon facing the court and arcane annex: bevelled flat roofs, one clock
    # pediment, windows sunk in shaded mullions, timber and cast-iron columns.
    def window_at(u,v,z,glow):
        face([(u,v,z),(u,v+4,z),(u,v+4,z+6),(u,v,z+6)],"#634557")
        face([(u,v+1,z+1),(u,v+3,z+1),(u,v+3,z+5),(u,v+1,z+5)],glow)
        beam((u,v,z+.7),(u,v+4,z+.7),"#e2ad82")
        beam((u,v+1,z+3),(u,v+3,z+3),"#87616b")

    def building(u,v,a,b,z,body,back,roof,window,clock=False):
        block(u,v,a,b,0,z,roof,body,back)
        for zz in range(3,z-1,3):
            beam((u,v,zz),(u,b,zz),"#a36d69" if clock else "#766479")
        for vv in range(v+3,b-3,6):
            window_at(u,vv,4,window)
        if z>=16:
            for vv in range(v+3,b-3,7):
                window_at(u,vv,z-8,window)
        # Porch and porch roof with alternate brackets.
        block(u-5,v-1,u,b+1,0,2,"#c7906b","#644650","#82606a")
        for vv in range(v,b+1,8):
            beam((u-4,vv,2),(u-4,vv,9),"#4e3949",2)
            beam((u-4,vv,2),(u-4,vv,9),"#ce966f")
        tile(u-6,v-2,u+1,b+2,10,"#794f58")
        beam((u-6,v-2,10),(u-6,b+2,10),"#eab681")
        tile(u-1,v-1,a+1,b+1,z+1,"#624d65")
        tile(u+1,v+1,a-1,b-1,z+1,roof)
        for uu in range(u+2,a,4):
            beam((uu,v+2,z+1),(uu,b-2,z+1),"#938090" if not clock else "#997476")
        beam((u-1,v-1,z+1),(u-1,b+1,z+1),"#efc18e")
        beam((u-1,b+1,z+1),(a+1,b+1,z+1),"#533f53")
        for vv in (v+2,b-3):
            beam((u,vv,11),(u,vv,z),"#f0bb88")
        if clock:
            # Raised, stepped Western false front and its nonverbal sundial.
            vv=(v+b)//2
            face([(u,vv-8,z),(u,vv-8,z+3),(u,vv-5,z+3),(u,vv-5,z+8),
                  (u,vv-3,z+8),(u,vv-3,z+10),(u,vv+4,z+10),
                  (u,vv+4,z+8),(u,vv+6,z+8),(u,vv+6,z+4),(u,vv+8,z+4),(u,vv+8,z)],"#cd9579")
            beam((u,vv-3,z+10),(u,vv+4,z+10),"#f3c993")
            x,y=iso(u,vv,z+5)
            poly([(x-3,y-1),(x-2,y-3),(x+1,y-2),(x+3,y),(x+2,y+3),(x,y+3),(x-3,y+1)],"#594457")
            poly([(x-2,y-1),(x-1,y-2),(x+1,y-1),(x+2,y),(x+1,y+2),(x-1,y+1)],"#edd29a")
            line([(x,y-1),(x,y),(x+1,y+1)],"#694b58")

    # Several back-lane buildings make the arena read as a town block.
    building(155,-23,172,6,13,"#97706f","#64576b","#8e7281","#d6ad84")
    building(139,-14,154,12,15,"#b58373","#755563","#a17a7d","#f3c786")
    building(136,13,162,49,18,"#c18a72","#81616a","#9d7880","#f9cd87",True)
    building(136,52,160,86,16,"#987982","#655c77","#81778a","#9bd4cb")
    for u,v,height in [(149,23,24),(145,57,21),(151,70,21)]:
        block(u,v,u+3,v+4,height-9,height,"#bba2a1","#795d71","#584b65")
        tile(u-1,v-1,u+4,v+5,height+1,"#b3948f")
    railing(128,-1,128,63,2,4,9)

    # Cast shadows behind the porch posts; small golden transoms catch light.
    for vv in (1,8,17,26,35,44,54,63,73,82):
        warm = vv<50
        face([(132,vv,2),(132,vv+4,2),(132,vv+4,7),(132,vv,7)],"#463944")
        face([(132,vv+1,4),(132,vv+3,4),(132,vv+3,6),(132,vv+1,6)],
             "#e2ac68" if warm else "#83c3bf")
        beam((132,vv+2,4),(132,vv+2,6),"#705260")
        beam((132,vv,2),(132,vv+4,2),"#dbab82")
    for u,v1,v2 in ((136,13,49),(136,52,86)):
        for vv in range(v1,v2,4):
            beam((u-6,vv,10),(u-1,vv,10),"#654a58")
        beam((u-5,v1,9),(u-5,v2,9),"#493749")
    # Shades break the facade into recessed bays; the wizard end has a
    # glazed oriel and small oxidized-copper steeple.
    for vv in (17,26,35,44):
        x,y=iso(136,vv,12)
        poly([(x,y-3),(x+2,y-3),(x+4,y-1),(x+4,y+2),(x,y)],"#745666")
        line([(x+1,y-2),(x+3,y-1)],"#f1c48b")
        dot(x+1,y-1,"#ffdd94")
    ox,oy=iso(145,62,16)
    poly([(ox-5,oy-2),(ox,oy-5),(ox+5,oy-2),(ox+5,oy+5),(ox,oy+8),(ox-5,oy+5)],"#4d455e")
    poly([(ox-4,oy-1),(ox,oy+1),(ox,oy+6),(ox-4,oy+4)],"#968498")
    poly([(ox+1,oy+1),(ox+4,oy-1),(ox+4,oy+4),(ox+1,oy+6)],"#655e7c")
    line([(ox-3,oy+1),(ox-3,oy+3)],"#beebd6")
    line([(ox+3,oy+1),(ox+3,oy+2)],"#75bfc0")
    poly([(ox-6,oy-2),(ox-3,oy-7),(ox,oy-14),(ox+2,oy-7),(ox+6,oy-2),(ox,oy+1)],"#645e7e")
    poly([(ox-6,oy-2),(ox-2,oy-7),(ox,oy-14),(ox,oy),(ox-2,oy)],"#89a7a5")
    dot(ox,oy-15,"#c8ead5")
    # Raked bleachers along the long rear rail, divided by two stair aisles.
    human_colors=["#d0a476","#e9be88","#ba8972","#d9aaa0","#9c7d94"]
    jackets=["#57827c","#a65d65","#5b607f","#a9846f","#7b7890","#b78c67","#716177","#797b66"]
    def little_person(x,y,style):
        j=jackets[style%len(jackets)]
        skin=human_colors[(style//3)%len(human_colors)]
        rect(x-1,y-1,x+1,y,"#423744")
        rect(x-1,y+1,x+1,y+2,j)
        dot(x,y-1,skin)
        if style%4==0:
            line([(x-2,y-2),(x+1,y-2)],"#4a3b4d");dot(x,y-3,"#785668")
        elif style%4==1:
            dot(x-1,y-2,"#8e748a");dot(x,y-3,"#8e748a")
        else: dot(x,y-2,"#533e51")
    for level in (3,2,1,0):
        near=-3-level*4; far=near-4
        for lo,hi in ((3,38),(43,78),(83,122)):
            block(lo,far,hi,near,0,2+level*2,"#b68c7c","#735968","#654f60")
            beam((lo,near,3+level*2),(hi,near,3+level*2),"#dcc0a0")
        for u in range(6,122,4):
            if 36<u<45 or 77<u<84 or rng.random()<.13: continue
            x,y=iso(u,near-2,3+level*2)
            little_person(x,y-1,rng.randrange(1,98))
    for start in (39,79):
        for j in range(4):
            tile(start,-7-j*4,start+3,-3-j*4,2+j*2,"#cba698")
            beam((start,-3-j*4,2+j*2),(start+3,-3-j*4,2+j*2),"#8b6e76")
    railing(0,-1,125,-1,2,4,13,"#b79985")

    # Roof over the middle row. Copper ridge, sea-green patina and a few
    # shadowed slats; leave the front three rows visible.
    for u in (19,73,110):
        beam((u,-19,1),(u,-19,17),"#544656",2)
        beam((u,-18,4),(u,-18,17),"#c39c85")
    tile(12,-22,116,-14,18,"#4e5564")
    tile(12,-21,116,-15,19,"#72968b")
    for u in range(13,116,4):
        beam((u,-21,19),(u,-15,19),"#8ca99a")
    beam((12,-14,18),(116,-14,18),"#d2b596")
    beam((12,-22,19),(116,-22,19),"#acc0a6")

    # Seated dealer at the ringside bell. Face and visor turn toward the
    # contestants, forearms rest on the ledger, chair legs stay in shadow.
    poly([(143,81),(150,78),(162,80),(164,82),(156,84),(147,83)],"#a76757")
    poly([(153,69),(158,68),(160,69),(160,77),(156,79),(152,77)],"#544458")
    line([(158,70),(158,76)],"#af836e")
    line([(156,77),(156,82)],"#524152")
    line([(160,77),(160,80)],"#524152")
    rect(152,76,156,78,"#3f485d")
    line([(153,78),(151,80),(150,80)],"#343449",2)
    line([(155,78),(155,80),(154,81)],"#495166")
    # A teal half-cap with an outstretched bill, distinct from the duel hats.
    poly([(149,68),(150,66),(153,65),(155,66),(156,69),(155,71),
          (152,72),(150,70)],"#3f394b")
    poly([(149,68),(153,68),(154,69),(154,71),(152,71),(149,70)],"#e4ad81")
    dot(150,69,"#503646")
    line([(151,66),(153,65),(155,66)],"#75b9a3")
    rect(150,66,154,67,"#24867c")
    line([(147,68),(154,68)],"#21565d")
    line([(147,67),(151,67)],"#86ceab")
    poly([(151,71),(154,70),(156,71),(157,74),(156,76),(152,77),
          (150,75),(148,74),(149,72)],"#554656")
    poly([(150,71),(153,72),(155,71),(156,73),(156,75),(152,76),
          (150,74),(148,74)],"#f1dbb3")
    line([(152,72),(153,73),(153,75)],"#4d807b")
    dot(155,74,"#cca586")
    # Low dark-wood desk with a gilt rail and an open two-page scorebook.
    poly([(140,75),(148,72),(155,75),(155,77),(147,80),(140,77)],"#634653")
    poly([(140,75),(147,73),(154,75),(147,78)],"#b97e60")
    dot(149,73,"#dca37a")
    line([(141,77),(141,80)],"#6e5058")
    line([(153,76),(153,79)],"#624952")
    poly([(140,74),(143,72),(146,73),(148,72),(151,73),(149,76),(146,77),
          (144,76),(142,77),(140,76)],"#463b50")
    poly([(140,74),(143,73),(146,74),(144,76),(141,75)],"#fff0b9")
    poly([(146,74),(148,73),(150,73),(149,75),(146,76),(145,76)],"#efdbab")
    line([(146,73),(145,75),(144,76)],"#85685f")
    dot(142,74,"#b39b82");dot(148,74,"#a58c78")
    dot(150,73,"#e1af83")
    # The tiny service bell sits just beyond the right leaf.
    line([(151,75),(155,76)],"#675066")
    rect(152,74,154,75,"#dca45f")
    dot(153,73,"#ffe3a2"); dot(152,75,"#ffcf81")

    def lamp(u,v,z,cyan=False):
        x,y=iso(u,v)
        poly([(x-1,y),(x+1,y-1),(x+9,y+1),(x+7,y+2)],"#987478")
        rect(x-1,y-2,x+1,y,"#66505d")
        rect(x-1,y-z+3,x,y-2,"#4a3b50")
        dot(x,y-z+6,"#b58c77");dot(x,y-2,"#c3977d")
        c="#b0f3e3" if cyan else "#ffdb90"
        rect(x-2,y-z,x+2,y-z+2,"#514354")
        rect(x-1,y-z,x+1,y-z+2,c)
        dot(x,y-z+1,"#fff3b9")
        line([(x-3,y-z-1),(x+3,y-z-1)],"#5e4554")
        rect(x-1,y-z-3,x+1,y-z-2,"#705867")
        dot(x,y-z-4,"#e0b78b")
    lamp(-2,-1,13); lamp(125,2,13)
    lamp(129,66,17,True)

    # Ground contact and projected shadows are drawn before the avatars.
    sx,sy=iso(27,22,2)
    wx,wy=iso(97,47,2)
    def shadow(x,y,n):
        poly([(x-5,y),(x-1,y-2),(x+5,y-2),(x+n,y+2),(x+n-2,y+4),(x+4,y+2)],"#a76757")
        line([(x-3,y),(x+6,y+1)],"#86545a")
    shadow(sx,sy,16);shadow(wx,wy,16)
    # Sheriff, profile facing screen-right. Hand-glazed brim, neckerchief,
    # brass badge, boot heels, split vest, holster, and one raised card.
    cowboy = [
        "        xxxooo             ",
        "       xhhlhhox            ",
        "       xhhlhhoo            ",
        "      xxhlhhhoooxx         ",
        "   xxohhhhhhhooohhxx       ",
        " xxhllhhhlllhhhhhhoox      ",
        "xohhhhhhhhhhhhoooxxx       ",
        " xxooooooxxffffx           ",
        "       xfffkfafx           ",
        "      xxafffffafx          ",
        "      xofffofffxx          ",
        "       xofbbbfx            ",
        "      xxrrfffx             ",
        "     xrrvrrrxx        gg   ",
        "    xovxvrrvvoxx     gGGg  ",
        "   xovvxvrGvvvoxx   xgGGg  ",
        "  xovvvxvhvvoffax  xfggg   ",
        "  xovovxvhhvvoxffxxffx     ",
        "  xooovxvhvvooxxaffax      ",
        "   xffaxbGGbxx  xxxx       ",
        "   xffxphhhhhx             ",
        "   xppppxxhxxx             ",
        "    xpppxxppx              ",
        "    xpqpx xppx             ",
        "   xppqpx xpqpx            ",
        "   xpqpx   xpppx           ",
        "   xhbbx   xbhhx           ",
        "  xohhhx    xhhho          ",
        "  xooooox   xooooox        "]
    cowboy_colors=dict(x="#382d3e",o="#67414b",h="#a76745",l="#efae68",
        f="#e8aa7e",a="#b77966",k="#453445",b="#764f49",
        r="#ce6656",v="#41666a",G="#ffdc85",g="#ba8048",
        p="#484d68",q="#65677a")
    sprite(cowboy,cowboy_colors,sx-10,sy-len(cowboy)+1)
    # Wizard, profile facing screen-left. Bent hat, cold hatband, stepped
    # hood and pointed sleeves. Staff and gem read at native resolution.
    wizard = [
        "                 xx       ",
        "               xxqx       ",
        "              xqoqx       ",
        "             xqqpx        ",
        "            xqqppx        ",
        "           xwqqppx        ",
        "          xwqqqpppx       ",
        "          xccqqpppx       ",
        "        xxccccqqpppx      ",
        "      xxwwwwwwqqqpppxx    ",
        "     xqqqqqqqqqqqqppppxx  ",
        "      xxxfffxofffxxxxxx   ",
        "        xfGffffffx        ",
        "       xaffffoxffx        ",
        "        xbbblbbffx        ",
        "         xblbbblxx        ",
        "        xwqbbblwqx        ",
        "       xwqqwbwwqqpx       ",
        "   xx xwqpqqCwqqpppx      ",
        "  xffxwqpxqccqqqpppx      ",
        "  xfffxpxwqqqqqppppx      ",
        "   xxxxxwqqqwwqqpppx      ",
        "       xwqqqwqqqpppx      ",
        "       xwqwwqqqqppppx     ",
        "      xwqqqqqqppqqppx     ",
        "      xwqqqqqppqqqqppx    ",
        "     xwqqqqqppqqqqppppx   ",
        "     xwqqqpccqqpppppppx   ",
        "    xwqccpqppppppppppppx  ",
        "    xpppppppxxxppppppppx  ",
        "    xxxxxxxx   xxxxxxxxx "]
    wiz_colors=dict(x="#352e45",o="#504260",q="#79679d",p="#534c74",
        w="#a994b4",c="#7ab8ba",C="#d9f0cc",f="#b5a4bc",a="#d4b9bf",
        G="#beffdc",b="#c0becb",l="#e3d7d0")
    sprite(wizard,wiz_colors,wx-12,wy-len(wizard)+1)
    staffx=wx-10
    line([(staffx+3,wy),(staffx,wy-20)],"#493a50",2)
    line([(staffx+2,wy-2),(staffx,wy-19)],"#ab8371")
    line([(staffx-1,wy-19),(staffx-3,wy-21),(staffx-3,wy-23)],"#705d79")
    line([(staffx+1,wy-19),(staffx+3,wy-22),(staffx+3,wy-24)],"#665a72")
    poly([(staffx,wy-27),(staffx+2,wy-24),(staffx+1,wy-21),
          (staffx-1,wy-21),(staffx-2,wy-24)],"#63b5b7")
    line([(staffx,wy-26),(staffx,wy-23)],"#c6fff0")
    dot(staffx-4,wy-26,"#9ce7da"); dot(staffx+4,wy-23,"#a6e8d4")

    # Two near corners of the audience and related street furniture, with
    # a break in the front rail to look into the arena from the entrance.
    railing(-5,3,-5,28,0,5,4)
    railing(-5,38,-5,60,0,5,4)
    railing(0,66,36,66,0,4,5)
    railing(91,66,124,66,0,4,5)
    lamp(3,74,14);lamp(119,74,14,True)
    def townsfolk(x,y,coat,hat,skin,turn=1):
        line([(x-2,y),(x+4,y+1)], "#8f706d")
        line([(x-1,y),(x-1,y-3)],"#3b4356")
        line([(x+1,y),(x+1,y-3)],"#4a4758")
        rect(x-2,y-5,x+1,y-3,coat)
        dot(x-2,y-3,skin)
        rect(x-1,y-7,x+1,y-6,skin)
        dot(x-turn,y-6,"#6d5054")
        line([(x-2,y-8),(x+2,y-8)],hat); dot(x,y-9,hat)
    townsfolk(78,120,"#3d7a78","#715349","#deab7b")
    townsfolk(82,122,"#ad6957","#664d52","#bc8b75",-1)
    townsfolk(181,92,"#786394","#493f58","#d4a781")
    townsfolk(190,95,"#3e7c77","#587173","#e3b38a",-1)
    # Low foreground shop, cool turquoise water trough, two weathered hitching posts.
    tile(51,78,105,83,0,"#a7807a")
    for u in range(53,102,8):
        tile(u,79,u+4,81,0,"#ce9e83")
    block(66,87,82,93,0,3,"#6c656f","#7e625e","#604b5c")
    tile(68,88,80,92,3,"#6e9c99")
    beam((68,89,3),(75,89,3),"#b4c5ad")
    for u in (58,64):
        block(u,88,u+1,90,0,5,"#d4aa87","#70525c","#916b65")
    beam((58,89,3),(66,89,3),"#b48870",2)
    for u,v in [(5,78),(-7,50),(110,85),(123,82),(61,105)]:
        x,y=iso(u,v)
        little_person(x,y-3,rng.randrange(100)); dot(x,y-4,"#edd2a8")
    def brush(x,y,s):
        poly([(x-5*s,y),(x-6*s,y-2*s),(x-4*s,y-2*s),(x-5*s,y-6*s),
              (x-2*s,y-3*s),(x-2*s,y-8*s),(x,y-4*s),(x+2*s,y-9*s),
              (x+2*s,y-3*s),(x+5*s,y-6*s),(x+4*s,y-2*s),(x+6*s,y-2*s),(x+3*s,y+1*s)],"#4e515a")
        line([(x-1,y-1),(x-2*s,y-5*s)],"#758675",s)
        line([(x+1,y-1),(x+3*s,y-5*s)],"#92a087",s)
    for x,y,s in [(2,105,2),(16,118,1),(234,100,1),(227,80,1),(205,108,1),
                  (226,127,2),(2,128,2),(153,131,1),(43,132,1),(35,110,1)]:
        brush(x,y,s)
    for x,y,s in [(14,109,.6),(23,130,1),(191,132,.9),(234,117,1),(2,109,.5)]:
        outcrop(x,y,s)
    # A stepped limestone street and covered market shelter frame the near
    # edge. Its roof stays below the duel so both players remain in view.
    tile(46,99,125,106,0,"#b18b83")
    for u in range(48,122,7):
        tile(u,100,u+4,101,0,"#d0aa91")
        tile(u+3,103,u+6,104,0,"#c39e8b")
    u0,v0=65,102
    block(u0,v0,u0+20,v0+12,0,3,"#e0ae85","#916a69","#6b5664")
    for u,v in ((u0+2,v0+1),(u0+19,v0+1),(u0+2,v0+11),(u0+19,v0+11)):
        beam((u,v,3),(u,v,13),"#594857",2)
        beam((u,v,4),(u,v,12),"#caa17d")
    block(u0+1,v0+3,u0+17,v0+7,3,5,"#cda581","#886965","#6a5260")
    for uu,cc in ((3,"#e7a66d"),(7,"#7db8aa"),(10,"#dea274"),(12,"#ad7d89")):
        x,y=iso(u0+uu,v0+4,6)
        rect(x-1,y-2,x+1,y,cc); dot(x,y-3,"#8b716a")
    tile(u0-1,v0-1,u0+21,v0+6,14,"#b98174")
    face([(u0-1,v0+5,15),(u0+21,v0+5,15),(u0+21,v0+14,11),(u0-1,v0+14,11)],"#805e70")
    for uu in range(u0,u0+19,6):
        tile(uu,v0-1,uu+2,v0+6,14,"#e7b690")
        face([(uu,v0+5,15),(uu+2,v0+5,15),(uu+2,v0+14,11),(uu,v0+14,11)],"#c49b9a")
    beam((u0-1,v0+5,15),(u0+21,v0+5,15),"#e8bf99")
    beam((u0-1,v0+14,11),(u0+21,v0+14,11),"#5d495c")
    for x,y,r in [(231,94,5),(239,91,6),(208,126,4),(8,131,5)]:
        cottonwood(x,y,r)
    def barrel(x,y):
        poly([(x-2,y-4),(x+1,y-5),(x+3,y-4),(x+3,y),(x,y+1),(x-2,y)],"#755666")
        line([(x-2,y-3),(x,y-2),(x+2,y-3)],"#c79879")
        line([(x-2,y),(x,y+1),(x+2,y)],"#675266")
        line([(x-1,y-4),(x+1,y-4)],"#e3b995")
    for x,y in [(181,113),(186,113),(184,109),(124,127),(121,126),(9,83)]:
        barrel(x,y)
    # Wooden wagon parked at the town edge.
    u,v=5,92
    block(u,v,u+13,v+7,1,5,"#ad836d","#926957","#674e55")
    tile(u+1,v+1,u+12,v+6,5,"#61515c")
    for uu in (u+2,u+10):
        x,y=iso(uu,v+8,1)
        poly([(x-2,y-1),(x,y-2),(x+2,y-2),(x+2,y),(x,y+2),(x-2,y+2)],"#4c4051")
        dot(x,y,"#c59676")
    # Ink each material separately. Keep the cool skyward planes, dark timber
    # and sunlit red dirt independent, with physically local accent colors.
    grade={
      "#4e415b":"#29334e","#77526b":"#774e68","#9d626c":"#b1636b",
      "#c58578":"#e9a079","#60556b":"#655e79","#6f6173":"#84748a",
      "#70616e":"#796a81","#564f65":"#48536e",
      "#4b405e":"#34435e","#536d83":"#497f95","#76909a":"#87c4bf",
      "#9f7272":"#ab8476","#ae827b":"#c59680","#986b6e":"#9e726e",
      "#b98b80":"#d1a28a","#a07778":"#c09684",
      "#42565b":"#21474d","#778976":"#478668","#abb18a":"#add181",
      "#4e515a":"#294e54","#758675":"#508a70","#92a087":"#91b982",
      "#4b4656":"#2e4952","#537468":"#397e69","#8f9d79":"#90bb82",
      "#4e5564":"#214d57","#72968b":"#2a887b","#8ca99a":"#58ae92",
      "#acc0a6":"#a7d1a7","#d2b596":"#dfbe93",
      "#5e4d5e":"#453c55","#725b65":"#664f62","#66505d":"#514154",
      "#4d3c4c":"#342f41","#5e454c":"#543a45","#4a3b50":"#303449",
      "#b68c7c":"#aa786a","#735968":"#59465a","#654f60":"#453c51",
      "#423744":"#282c40","#4a3b4d":"#343145","#785668":"#735361",
      "#57827c":"#338c7f","#a65d65":"#ba555b","#5b607f":"#47678a",
      "#b78c67":"#d29859","#716177":"#62527d","#d9aaa0":"#ecb397",
      "#cf805b":"#d97848","#c37959":"#c76c46","#db8e64":"#e88b55",
      "#c47453":"#c56140","#d98a60":"#e78750","#dc976a":"#ec9c62",
      "#d18460":"#dc7e4b","#b96a50":"#b65d41","#f4c68b":"#ffdb9b",
      "#f2bc86":"#ffe0a1","#b56e54":"#bf6847","#eab482":"#f3b582",
      "#a76757":"#b36049","#86545a":"#80505a",
      "#b48b76":"#bc8567","#4d455e":"#35364e","#81778a":"#657792",
      "#938090":"#8396a7","#81778a":"#68798c","#9d7880":"#8f727b",
      "#675266":"#534155","#483950":"#302a40","#4c4051":"#352f45",
      "#dcaa8a":"#e6b58e","#eab681":"#ffcd8e","#efc18e":"#ffe0a2",
      "#866b6a":"#715451","#5d495c":"#40344d","#c49b9a":"#dcc3ac",
      "#b98174":"#c57762","#805e70":"#955867","#584b65":"#393851",
      "#645e7e":"#495074","#89a7a5":"#6caaa9","#81616a":"#6f495a",
      "#c18a72":"#d9976f","#81616a":"#78525b","#a36d69":"#a95f56",
      "#372d3e":"#262638","#382d3e":"#201e32","#67414b":"#53323a",
      "#a76745":"#a85d37","#efae68":"#ffba68","#ce6656":"#e85b42",
      "#41666a":"#29756e","#484d68":"#30445e","#65677a":"#68768a",
      "#352e45":"#231e36","#504260":"#443060","#79679d":"#8960b3",
      "#534c74":"#4e3b77","#a994b4":"#b495ce","#7ab8ba":"#62c6ca",
      "#d9f0cc":"#caffde","#b5a4bc":"#c8b4d4","#e3d7d0":"#f5e1d1",
      "#63b5b7":"#38c0c4","#c6fff0":"#d8ffeb","#b0f3e3":"#9bffe5",
      "#a6e8d4":"#a9ffdf","#ffc65a":"#ffcf74","#ffdb90":"#ffd072",
      "#665a72":"#46465f","#705d79":"#51435f","#767383":"#536180"
    }
    # Palette mapping preserves every line and every Bayer-like clay fleck.
    rgb=lambda value: tuple(int(value[k:k+2],16) for k in (1,3,5))
    pigments={rgb(old):rgb(new) for old,new in grade.items()}
    image.putdata([pigments.get(pixel,pixel) for pixel in image.getdata()])
    return image


@lru_cache(maxsize=1)
def pixel_scene():
    """Return one self-contained SVG symbol with flat, integer pixel edges."""
    image = _paint()
    colors = defaultdict(list)
    width,height = image.size
    # Fuse equal neighboring row spans; opaque fills tile the original grid.
    active = {}
    for y in range(height + 1):
        current = set()
        if y < height:
            row = [image.getpixel((x,y)) for x in range(width)]
            x = 0
            while x < width:
                start=x; c=row[x]
                while x < width and row[x] == c:
                    x += 1
                current.add((start,x,c))
        for key in active.keys() - current:
            x,x2,c=key
            top=active[key]
            colors[c].append((x,top,x2-x,y-top))
        active = {key:active.get(key,y) for key in current}
    out = ['<symbol id="arena-scene" viewBox="0 0 240 134" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">']
    for rgb, blocks in sorted(colors.items()):
        color = "#%02x%02x%02x" % rgb
        path = "".join(f"M{x} {y}h{dx}v{dy}h-{dx}z" for x,y,dx,dy in sorted(blocks,key=lambda b:(b[1],b[0])))
        out.append(f'<path fill="{color}" d="{path}"/>')
    out.append("</symbol>")
    return "".join(out)
