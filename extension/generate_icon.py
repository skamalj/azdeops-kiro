#!/usr/bin/env python3
"""
Generate a professional PNG icon for the Azure DevOps Integration extension
"""

try:
    from PIL import Image, ImageDraw
    import math
    
    def create_icon():
        # Create 128x128 image with transparent background
        size = 128
        img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        # Azure blue colors
        azure_blue = (0, 120, 212)
        azure_dark = (0, 90, 158)
        white = (255, 255, 255)
        vscode_blue = (0, 122, 204)
        
        # Main circle background
        center = size // 2
        radius = 58
        
        # Draw main circle with gradient effect (simplified)
        for i in range(radius, 0, -1):
            alpha = int(255 * (i / radius))
            color = tuple(int(azure_blue[j] + (azure_dark[j] - azure_blue[j]) * (1 - i/radius)) for j in range(3))
            draw.ellipse([center-i, center-i, center+i, center+i], 
                        fill=color + (alpha,), outline=None)
        
        # Border
        draw.ellipse([center-radius, center-radius, center+radius, center+radius], 
                    outline=azure_dark, width=2)
        
        # Main hexagon (Azure DevOps shape)
        hex_points = []
        hex_center_x, hex_center_y = center, center - 5
        hex_radius = 25
        for i in range(6):
            angle = i * math.pi / 3
            x = hex_center_x + hex_radius * math.cos(angle - math.pi/2)
            y = hex_center_y + hex_radius * math.sin(angle - math.pi/2)
            hex_points.append((x, y))
        
        draw.polygon(hex_points, fill=white, outline=azure_blue, width=1)
        
        # Work item lines (representing tasks/stories)
        line_y_start = center - 20
        draw.rectangle([center-16, line_y_start, center+16, line_y_start+2], fill=azure_blue)
        draw.rectangle([center-16, line_y_start+6, center+8, line_y_start+8], fill=azure_blue)
        draw.rectangle([center-16, line_y_start+12, center+12, line_y_start+14], fill=azure_blue)
        
        # Sprint dots (representing iterations)
        dot_y = center + 5
        for x_offset in [-8, 0, 8]:
            draw.ellipse([center+x_offset-2, dot_y-2, center+x_offset+2, dot_y+2], fill=azure_blue)
        
        # Dashboard chart line (simplified)
        chart_points = [
            (center-12, center+18),
            (center-6, center+15),
            (center, center+20),
            (center+6, center+12),
            (center+12, center+16)
        ]
        for i in range(len(chart_points)-1):
            draw.line([chart_points[i], chart_points[i+1]], fill=azure_blue, width=2)
        
        # VS Code integration badge
        badge_size = 8
        badge_x = center + 25
        badge_y = center + 25
        draw.rectangle([badge_x, badge_y, badge_x+badge_size, badge_y+badge_size], 
                      fill=vscode_blue)
        draw.rectangle([badge_x+1, badge_y+1, badge_x+badge_size-1, badge_y+badge_size-1], 
                      fill=white)
        
        return img
    
    # Generate and save the icon
    icon = create_icon()
    icon.save('icon.png', 'PNG')
    print("✅ Icon generated successfully: icon.png")
    print("📏 Size: 128x128 pixels")
    print("🎨 Format: PNG with transparency")
    
except ImportError:
    print("❌ PIL (Pillow) not installed. Install with: pip install Pillow")
    print("📝 Alternative: Open create-icon.html in a browser and click 'Download Icon'")
except Exception as e:
    print(f"❌ Error generating icon: {e}")
    print("📝 Alternative: Open create-icon.html in a browser and click 'Download Icon'")