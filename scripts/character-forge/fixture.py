"""Original synthetic turnaround, drawn independently of the reconstruction mesh."""
from pathlib import Path
import json
from PIL import Image,ImageDraw

def create_fixture(root):
    root=Path(root);root.mkdir(parents=True,exist_ok=True)
    images=[]
    for view in ('front','side','back'):
        image=Image.new('RGBA',(180,360),'white');d=ImageDraw.Draw(image)
        if view=='side':
            d.ellipse((68,18,120,95),fill='#294064');d.polygon([(72,33),(65,50),(60,62),(67,69),(68,86),(94,91),(104,53)],fill='#e4b089')
            d.rectangle((78,89,96,111),fill='#e4b089');d.polygon([(74,103),(109,106),(118,161),(105,224),(75,224),(69,158)],fill='#2d9db0')
            d.rounded_rectangle((78,111,98,207),radius=8,fill='#e4b089')
            d.polygon([(78,215),(103,215),(103,308),(75,308)],fill='#243a55');d.rounded_rectangle((60,302,108,334),radius=6,fill='#ad6133')
        else:
            d.ellipse((55,18,125,96),fill='#294064')
            if view=='front':
                d.ellipse((62,35,118,94),fill='#e4b089');d.polygon([(56,41),(70,22),(115,24),(124,48),(105,40),(95,50),(76,43)],fill='#294064')
                d.ellipse((73,56,79,64),fill='#20304a');d.ellipse((101,56,107,64),fill='#20304a');d.line((81,78,99,78),fill='#a15f56',width=2)
            else:d.polygon([(61,38),(119,38),(129,120),(105,112),(90,125),(68,113),(53,119)],fill='#294064')
            d.rectangle((81,92,99,110),fill='#e4b089')
            d.polygon([(66,106),(114,106),(124,150),(115,184),(121,223),(59,223),(65,184),(56,150)],fill='#2d9db0' if view=='front' else '#315f95')
            d.rectangle((63,172,117,183),fill='#dcb761')
            for x in (40,122):d.rounded_rectangle((x,112,x+18,207),radius=8,fill='#e4b089');d.rounded_rectangle((x,194,x+18,220),radius=7,fill='#e4b089')
            for x in (62,97):d.rectangle((x,217,x+21,309),fill='#243a55');d.rounded_rectangle((x-4,300,x+25,334),radius=6,fill='#ad6133')
            if view=='back':d.polygon([(90,128),(104,148),(90,161),(76,148)],fill='#dcb761')
        image.save(root/(view+'.png'));images.append(image)
    sheet=Image.new('RGBA',(600,380),'white')
    for i,image in enumerate(images):sheet.alpha_composite(image,(10+i*200,10))
    sheet.save(root/'character-sheet.png')
    # These two convenience images are generated blends, NOT observed views.
    # Reconstruction admits only the independently drawn front/side/back.
    for name,a,b in [('front34',images[0],images[1]),('back34',images[2],images[1])]:
        Image.blend(a,b,.35).save(root/(name+'.png'))
    (root/'provenance.json').write_text(json.dumps({'author':'RINNE contributors','license':'RINNE-OWNED','source':'Original synthetic fixture: scripts/character-forge/fixture.py','thirdPartyAssets':False,'views':{'front':'observed original drawing','side':'observed original drawing','back':'observed original drawing','front34':'generated blend; not reconstruction evidence','back34':'generated blend; not reconstruction evidence'}},indent=2)+'\n')
    return root

if __name__=='__main__':
    import sys
    print(create_fixture(sys.argv[1]))
