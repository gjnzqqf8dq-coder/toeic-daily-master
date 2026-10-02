#!/bin/zsh
# index.html は src の3ファイルを連結して作る（index.html を直接編集しない）
cd "$(dirname "$0")"
cat src/partA.html src/logic.js src/partC.js > index.html
cat src/logic.js src/partC.js | sed '/<\/script>/,$d' > /tmp/tdm_chk.js && node --check /tmp/tdm_chk.js && echo "build ok"
