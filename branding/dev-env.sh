# Toolchain de este proyecto. Se usa con `source`, no se ejecuta:
#
#     source branding/dev-env.sh
#
# Existe porque el `preinstall` corre `npx solidarity`, que valida versiones
# exactas y aborta el npm install si alguna no da. Los defaults de la maquina
# (node 18, ruby 2.6 del sistema, cocoapods de brew) no pasan.

# Node 24.15.0 — lo pide .nvmrc / .node-version. El default de nvm es 18.
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1
nvm use 24.15.0 >/dev/null 2>&1

# Ruby de brew (>=3.2.0). La del sistema es 2.6.10 y no pasa solidarity.
# El dir de gems va PRIMERO: ahi esta cocoapods 1.16.1, la version exacta que
# fija el Gemfile. brew instalo 1.17.0 en /usr/local/bin/pod, que NO pasa.
export PATH="/usr/local/lib/ruby/gems/4.0.0/bin:/usr/local/opt/ruby/bin:$PATH"

# SDK de Android. Estaba instalado pero sin exportar.
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export PATH="$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin"

# Lo pide el README de Mattermost para que node no se quede sin memoria.
export NODE_OPTIONS=--max_old_space_size=12000
