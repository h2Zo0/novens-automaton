tar() {
  command /bin/tar "$@"
  local rc=$?
  if [ $rc -eq 0 ]; then
    [ -f cloud/render-patch-auth.mjs ] && node cloud/render-patch-auth.mjs
    [ -f cloud/render-patch-portfolio.mjs ] && node cloud/render-patch-portfolio.mjs
  fi
  return $rc
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
