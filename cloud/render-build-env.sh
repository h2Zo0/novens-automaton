tar() {
  command /bin/tar "$@"
  local rc=$?
  if [ $rc -eq 0 ] && [ -f cloud/render-patch-auth.mjs ]; then
    node cloud/render-patch-auth.mjs
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
