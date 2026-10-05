tar() {
  command /bin/tar "$@"
  local rc=$?
  if [ $rc -ne 0 ]; then
    return $rc
  fi
  if [ -f cloud/local-sync.patch.b64 ]; then
    base64 -d cloud/local-sync.patch.b64 | git apply --whitespace=nowarn - || return $?
  fi
  [ -f cloud/render-patch-auth.mjs ] && node cloud/render-patch-auth.mjs || return $?
  [ -f cloud/render-patch-portfolio.mjs ] && node cloud/render-patch-portfolio.mjs || return $?
  [ -f cloud/render-patch-paper-guard.mjs ] && node cloud/render-patch-paper-guard.mjs || return $?
  return 0
}
corepack() {
  case "$1" in
    enable|prepare) return 0 ;;
    *) command /usr/bin/corepack "$@" ;;
  esac
}
pnpm() {
  command /usr/bin/corepack pnpm "$@"
}
