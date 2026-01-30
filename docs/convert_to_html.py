"""
Convert Markdown documentation to HTML format for easy browser viewing
"""

def create_html(md_content, title):
    """Convert markdown to HTML with styling"""
    
    # Simple markdown to HTML conversion
    html = md_content
    
    # Convert headers
    import re
    html = re.sub(r'^# (.*?)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)
    html = re.sub(r'^## (.*?)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
    html = re.sub(r'^### (.*?)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
    html = re.sub(r'^#### (.*?)$', r'<h4>\1</h4>', html, flags=re.MULTILINE)
    
    # Convert bold and italic
    html = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', html)
    html = re.sub(r'\*(.*?)\*', r'<em>\1</em>', html)
    
    # Convert inline code
    html = re.sub(r'`([^`]+)`', r'<code>\1</code>', html)
    
    # Convert code blocks
    html = re.sub(r'```(\w+)?\n(.*?)```', r'<pre><code>\2</code></pre>', html, flags=re.DOTALL)
    
    # Convert links
    html = re.sub(r'\[([^\]]+)\]\(([^\)]+)\)', r'<a href="\2">\1</a>', html)
    
    # Convert line breaks
    html = html.replace('\n\n', '</p><p>')
    
    # Wrap in HTML structure
    full_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .container {{
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        h1 {{
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }}
        h2 {{
            color: #34495e;
            margin-top: 30px;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 8px;
        }}
        h3 {{
            color: #555;
            margin-top: 20px;
        }}
        h4 {{
            color: #666;
        }}
        code {{
            background: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }}
        pre {{
            background: #2d2d2d;
            color: #f8f8f2;
            padding: 15px;
            border-radius: 5px;
            overflow-x: auto;
        }}
        pre code {{
            background: none;
            color: inherit;
            padding: 0;
        }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 20px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{
            background: #3498db;
            color: white;
            font-weight: bold;
        }}
        tr:nth-child(even) {{
            background: #f9f9f9;
        }}
        tr:hover {{
            background: #f5f5f5;
        }}
        a {{
            color: #3498db;
            text-decoration: none;
        }}
        a:hover {{
            text-decoration: underline;
        }}
        .emoji {{
            font-size: 1.2em;
        }}
        p {{
            margin: 15px 0;
        }}
        ul, ol {{
            margin: 15px 0;
            padding-left: 30px;
        }}
        li {{
            margin: 8px 0;
        }}
    </style>
</head>
<body>
    <div class="container">
        {html}
    </div>
</body>
</html>"""
    
    return full_html


# Read and convert each markdown file
import os

md_files = {
    'architecture_flow.md': 'System Architecture Flow',
    'excel_diagrams.md': 'Excel Diagrams & Presentation Materials',
    'socketio_internals.md': 'Socket.IO Internals Deep Dive',
    'complete_message_flow.md': 'Complete Message Flow - Detailed Journey',
    'backend_scaling_analysis.md': 'Backend Analysis & Scaling for 100K Users'
}

for md_file, title in md_files.items():
    if os.path.exists(md_file):
        with open(md_file, 'r', encoding='utf-8') as f:
            md_content = f.read()
        
        html_content = create_html(md_content, title)
        html_file = md_file.replace('.md', '.html')
        
        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        print(f'✅ Created {html_file}')

print('\n✨ All HTML files created! Open them in any web browser.')
