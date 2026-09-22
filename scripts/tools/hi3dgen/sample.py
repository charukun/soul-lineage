"""Original 2D illustration fixture; not a mesh or inference substitute."""
from pathlib import Path
import sys
from PIL import Image, ImageDraw, ImageFilter


def make_sample(path: Path) -> None:
    if path.exists():
        raise ValueError('Refusing to replace an existing input image')
    image = Image.new('RGB', (768, 768), '#f6f3ed')
    shadow = Image.new('RGBA', image.size)
    ImageDraw.Draw(shadow).ellipse((235, 650, 548, 687), fill=(65, 49, 29, 48))
    image = Image.alpha_composite(image.convert('RGBA'), shadow.filter(ImageFilter.GaussianBlur(12)))
    draw = ImageDraw.Draw(image)
    draw.polygon([(321,243),(443,243),(461,331),(519,399),(537,577),(493,647),(379,675),(263,643),(229,565),(245,410),(310,330)], fill='#315c65', outline='#183d45', width=5)
    draw.polygon([(321,251),(358,260),(346,354),(293,418),(275,568),(306,642),(263,638),(234,565),(250,412),(314,332)], fill='#74a6a7')
    draw.polygon([(358,260),(403,261),(411,345),(457,403),(462,587),(420,661),(377,669),(310,644),(279,566),(298,420),(350,356)], fill='#4d888e')
    draw.polygon([(411,345),(455,333),(515,401),(532,574),(488,643),(427,663),(467,584),(462,402)], fill='#274d59')
    draw.polygon([(245,414),(295,429),(383,440),(458,421),(521,399),(520,433),(456,455),(381,474),(291,458),(241,443)], fill='#bd9750', outline='#725528', width=3)
    draw.polygon([(293,430),(383,440),(458,421),(458,454),(381,473),(293,458)], fill='#dec482')
    draw.ellipse((302,218,456,282), fill='#80602f', outline='#594122', width=4)
    draw.rectangle((303,215,455,250), fill='#be994b')
    draw.ellipse((303,193,455,247), fill='#e2c57f', outline='#80602f', width=4)
    draw.polygon([(327,159),(427,154),(432,212),(405,230),(352,231),(324,211)], fill='#987445', outline='#654e30', width=4)
    draw.ellipse((326,138,429,184), fill='#cfb17e', outline='#806038', width=4)
    draw.line((340,187,339,210), fill='#c0a16e', width=7)
    draw.polygon([(329,494),(389,510),(426,543),(388,582),(329,565),(307,530)], fill='#e8dac0', outline='#c4b085', width=4)
    draw.polygon([(366,516),(394,540),(372,561),(346,537)], fill='#637778')
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert('RGB').save(path, format='PNG', optimize=True)


if __name__ == '__main__':
    make_sample(Path(sys.argv[1]))
