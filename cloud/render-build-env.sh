tar() {
  command /bin/tar "$@"
  local rc=$?
  if [ $rc -eq 0 ]; then
    [ -f cloud/render-patch-auth.mjs ] && node cloud/render-patch-auth.mjs
    [ -f cloud/render-patch-portfolio.mjs ] && node cloud/render-patch-portfolio.mjs
    [ -f cloud/render-patch-runtime.mjs ] && node cloud/render-patch-runtime.mjs
    [ -f cloud/render-patch-inference-preflight.mjs ] && node cloud/render-patch-inference-preflight.mjs
    [ -f cloud/economy-policy-a.patch ] && git apply --whitespace=nowarn cloud/economy-policy-a.patch
    [ -f cloud/economy-policy-b.patch ] && git apply --whitespace=nowarn cloud/economy-policy-b.patch
    [ -f cloud/economy-policy-c.patch ] && git apply --whitespace=nowarn cloud/economy-policy-c.patch
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
