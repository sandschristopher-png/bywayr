from PIL import Image

feature_graphic = Image.open("Feature Graphic.jpg").convert("RGBA")
icon = Image.open("icon-512.png").convert("RGBA")

icon_size = (320, 320)
icon_resized = icon.resize(icon_size, Image.Resampling.LANCZOS)

paste_position = (112, 90)
feature_graphic.paste(icon_resized, paste_position, icon_resized)

output_path = "Feature-Graphic-Updated.jpg"
feature_graphic.convert("RGB").save(output_path, quality=95)
print(f"Successfully generated updated feature graphic at: {output_path}")
