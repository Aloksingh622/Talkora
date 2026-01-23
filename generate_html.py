#!/usr/bin/env python3
"""
System Design HTML Generator (Print to PDF)
Converts system_design.md to a print-ready HTML file
Open in browser and use Ctrl+P to save as PDF
"""

import markdown
from pathlib import Path
import re
from datetime import datetime

def convert_md_to_html():
    """Convert system design markdown to print-ready HTML"""
    
    # File paths
    md_file = Path(__file__).parent / 'system_design.md'
    output_html = Path(__file__).parent / 'system_design.html'
    
    # Read markdown content
    with open(md_file, 'r', encoding='utf-8') as f:
        md_content = f.read()
    
    # Remove mermaid diagrams (replace with text note)
    md_content = re.sub(
        r'```mermaid.*?```', 
        '\n> **📊 Diagram:** See interactive version at [system_design.md](system_design.md)\n', 
        md_content, 
        flags=re.DOTALL
    )
    
    # Convert markdown to HTML
    md = markdown.Markdown(extensions=[
        'tables',
        'fenced_code',
        'codehilite',
        'toc',
        'attr_list',
        'md_in_html'
    ])
    html_content = md.convert(md_content)
    
    # Create full HTML document
    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>System Design - Talkora (Discord Clone)</title>
    <style>
        /* Print-specific styles */
        @media print {{
            @page {{
                size: A4;
                margin: 2cm;
            }}
            
            body {{
                font-size: 11pt;
            }}
            
            h1 {{
                page-break-before: always;
                margin-top: 0;
            }}
            
            h1:first-of-type {{
                page-break-before: avoid;
            }}
            
            h2, h3 {{
                page-break-after: avoid;
            }}
            
            table, pre, blockquote {{
                page-break-inside: avoid;
            }}
            
            .no-print {{
                display: none;
            }}
            
            a {{
                text-decoration: none;
                color: #333;
            }}
            
            .cover {{
                page-break-after: always;
            }}
        }}
        
        /* Screen and print styles */
        * {{
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.7;
            color: #333;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background: #fff;
        }}
        
        /* Cover page */
        .cover {{
            text-align: center;
            padding: 150px 40px;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
        }}
        
        .cover h1 {{
            font-size: 48px;
            color: #5865F2;
            margin: 0 0 30px 0;
            font-weight: 800;
            border: none;
        }}
        
        .cover .subtitle {{
            font-size: 24px;
            color: #666;
            margin: 15px 0;
            font-weight: 400;
        }}
        
        .cover .author {{
            font-size: 16px;
            color: #999;
            margin-top: 50px;
        }}
        
        .cover .date {{
            font-size: 14px;
            color: #bbb;
            margin-top: 20px;
        }}
        
        /* Print button */
        .print-button {{
            position: fixed;
            top: 20px;
            right: 20px;
            background: #5865F2;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 4px 12px rgba(88, 101, 242, 0.3);
            transition: all 0.3s;
            z-index: 1000;
        }}
        
        .print-button:hover {{
            background: #4752C4;
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(88, 101, 242, 0.4);
        }}
        
        /* Headings */
        h1 {{
            color: #2c3e50;
            border-bottom: 4px solid #5865F2;
            padding-bottom: 12px;
            margin-top: 40px;
            margin-bottom: 20px;
            font-weight: 700;
        }}
        
        h2 {{
            color: #34495e;
            border-left: 5px solid #5865F2;
            padding-left: 20px;
            margin-top: 35px;
            margin-bottom: 15px;
            font-weight: 600;
        }}
        
        h3 {{
            color: #555;
            margin-top: 25px;
            margin-bottom: 12px;
            font-weight: 600;
        }}
        
        h4 {{
            color: #666;
            font-style: italic;
            margin-top: 20px;
        }}
        
        /* Tables */
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 25px 0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        
        th {{
            background: linear-gradient(135deg, #5865F2 0%, #4752C4 100%);
            color: white;
            padding: 14px 12px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
        }}
        
        td {{
            padding: 12px;
            border-bottom: 1px solid #e1e4e8;
        }}
        
        tr:nth-child(even) {{
            background-color: #f8f9fa;
        }}
        
        tr:hover {{
            background-color: #f0f2ff;
        }}
        
        /* Code */
        code {{
            background-color: #f6f8fa;
            padding: 3px 8px;
            border-radius: 4px;
            font-family: 'Courier New', Consolas, monospace;
            font-size: 13px;
            color: #e74c3c;
            border: 1px solid #e1e4e8;
        }}
        
        pre {{
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: #ecf0f1;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 20px 0;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }}
        
        pre code {{
            background: transparent;
            color: #ecf0f1;
            padding: 0;
            border: none;
        }}
        
        /* Blockquotes */
        blockquote {{
            border-left: 5px solid #5865F2;
            margin: 20px 0;
            padding: 15px 25px;
            background: #f8f9ff;
            color: #555;
            font-style: italic;
            border-radius: 4px;
        }}
        
        /* Lists */
        ul, ol {{
            margin: 15px 0;
            padding-left: 35px;
        }}
        
        li {{
            margin: 8px 0;
        }}
        
        /* Links */
        a {{
            color: #5865F2;
            text-decoration: none;
            border-bottom: 1px solid transparent;
            transition: border-color 0.3s;
        }}
        
        a:hover {{
            border-bottom-color: #5865F2;
        }}
        
        /* Badges */
        strong {{
            color: #2c3e50;
            font-weight: 600;
        }}
        
        /* Horizontal rules */
        hr {{
            border: none;
            height: 2px;
            background: linear-gradient(90deg, transparent, #5865F2, transparent);
            margin: 40px 0;
        }}
        
        /* Emoji support */
        img.emoji {{
            height: 1em;
            width: 1em;
            margin: 0 .05em 0 .1em;
            vertical-align: -0.1em;
        }}
    </style>
</head>
<body>
    <button class="print-button no-print" onclick="window.print()">🖨️ Print to PDF</button>
    
    <div class="cover">
        <h1>Professional System Design</h1>
        <div class="subtitle"><strong>Talkora</strong> - Discord Clone</div>
        <div class="subtitle">Real-time Chat Application</div>
        <div class="subtitle" style="font-size: 18px; margin-top: 40px;">Architecture Analysis & Scalability Roadmap</div>
        <div class="author">System Architecture Documentation</div>
        <div class="date">Generated: {datetime.now().strftime('%B %Y')}</div>
    </div>
    
    {html_content}
    
    <script>
        // Add smooth scroll behavior
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {{
            anchor.addEventListener('click', function (e) {{
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {{
                    target.scrollIntoView({{ behavior: 'smooth' }});
                }}
            }});
        }});
    </script>
</body>
</html>
"""
    
    # Write HTML file
    with open(output_html, 'w', encoding='utf-8') as f:
        f.write(full_html)
    
    print("✅ HTML generated successfully!")
    print(f"📄 Location: {output_html}")
    print(f"📊 Size: {output_html.stat().st_size / 1024:.2f} KB")
    print("\n🖨️  To create PDF:")
    print("   1. Open system_design.html in your browser")
    print("   2. Press Ctrl+P (or click the Print button)")
    print("   3. Select 'Save as PDF' as the printer")
    print("   4. Click 'Save'")
    print("\n💡 The HTML file is fully styled and ready for printing!")

if __name__ == '__main__':
    try:
        convert_md_to_html()
    except Exception as e:
        print(f"❌ Error: {e}")
        raise
