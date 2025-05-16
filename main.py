import streamlit as st
import json
import os
from generator import generate_inputs, generate_image

# Configure page and container width
st.set_page_config(layout="wide")
st.markdown(
    """
    <style>
    .block-container { max-width: 90% !important; }
    </style>
    """,
    unsafe_allow_html=True
)

# Initialize session state defaults for copy_text_main, copy_text_sub, captions_en, captions_ja
for key in ('copy_text_main', 'copy_text_sub', 'captions_en', 'captions_ja'):
    if key not in st.session_state:
        st.session_state[key] = ''

# Load template choices from JSON
template_path = os.path.join(os.path.dirname(__file__), 'template.json')
try:
    with open(template_path, 'r', encoding='utf-8') as tf:
        _templates_json = json.load(tf)
        # extract template names and colors
        templates = [tpl.get('name', tpl.get('id', '')) for tpl in _templates_json]
        # store color mapping in session_state
        template_colors = {tpl.get('name', tpl.get('id', '')): tpl.get('color', []) for tpl in _templates_json}
        st.session_state['template_colors'] = template_colors
except Exception:
    templates = []

# Title and sidebar configuration
st.title("POP Generator")

# Main content
st.header("POP 生成 | POP Generator")
# Show description
st.write("入力された情報から POP を自動生成します。| Create POP Image from your input.")

# Split UI into two columns
col1, col2 = st.columns([4, 6])

with col1:
    # Objectives and goals inputs
    objectives = st.text_area("やりたいこと、目的を入力 | Input Objectives", "")
    generate_inputs_clicked = st.button("Generate inputs", disabled=not (objectives))

    if generate_inputs_clicked:
        try:
            res = generate_inputs(objectives)
            if res:
                # st.text_area("Generated JSON", json.dumps(res, ensure_ascii=False, indent=2))
                parsed_res = res if isinstance(res, dict) else json.loads(res)
                st.session_state['copy_text_main'] = parsed_res.get('copy_text_main', '')
                st.session_state['copy_text_sub'] = parsed_res.get('copy_text_sub', '')
                st.session_state['captions_en'] = parsed_res.get('captions_en', '')
                st.session_state['captions_ja'] = parsed_res.get('captions_ja', '')
            else:
                st.error("入力プロンプト生成中にエラーが発生しました。")
        except Exception as e:
            st.error(f"入力プロンプト生成に失敗しました: {e}")

    # copy_text and captions inputs bound to session state
    copy_text_main = st.text_input("メインテキスト | Letters to include as main", key='copy_text_main')
    copy_text_sub = st.text_input("サブテキスト | Letters to include as sub", key='copy_text_sub')
    captions_ja = st.text_area("生成したい画像の説明 | image captions to generate", key='captions_ja')
    captions_en = st.write(st.session_state['captions_en'])

    # POP generation template selection as horizontal checkboxes
    st.write("テンプレート | Select Color Template")
    # limit selection to 3 maximum
    selected_count = sum(st.session_state.get(f"template_{tmpl}", False) for tmpl in templates)
    selected_templates = []
    cols = st.columns(len(templates))
    for col, tmpl in zip(cols, templates):
        with col:
            checked = st.checkbox(
                tmpl,
                key=f"template_{tmpl}",
                disabled=not st.session_state.get(f"template_{tmpl}", False) and selected_count >= 3
            )
            if checked:
                selected_templates.append(tmpl)
    # store selected templates in session state
    st.session_state['template_selected'] = selected_templates

    # POP generation button
    generate_img = st.button("Generate POP", disabled=not (copy_text_main and captions_ja))

with col2:
    # Image display area
    if generate_img:
        prompt = st.session_state['captions_ja'] + ", Clearly shown Main Text: " + st.session_state['copy_text_main'] + ", Sub Text: " + st.session_state['copy_text_sub']
        if selected_templates:
            img_cols = st.columns(len(selected_templates))
            for i in range(len(selected_templates)):
                with img_cols[i]:
                    this_prompt = prompt + " Key Colors: " + str(template_colors.get(selected_templates[i], [])) + " Dominant color: #FFFFFF"
                    try:
                        with st.spinner('画像を生成中...'):
                            img_name = "pop_image_" + str(i) + ".jpg"
                            res = generate_image(this_prompt, img_name)
                        if res:
                            st.write(f"Template: {selected_templates[i]}")
                            st.image(img_name, caption=st.session_state['captions_en'],width=300)
                        else:
                            st.error("画像生成中にエラーが発生しました。")
                    except Exception as e:
                        st.error(f"画像生成に失敗しました: {e}")
        else:
            try:
                with st.spinner('画像を生成中...'):
                    res = generate_image(prompt, "pop_image.jpg")
                if res:
                    st.image("pop_image.jpg", caption=st.session_state['captions_en'],width=300)
                else:
                    st.error("画像生成中にエラーが発生しました。")
            except Exception as e:
                st.error(f"画像生成に失敗しました: {e}")

