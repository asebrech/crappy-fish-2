{ pkgs, lib, config, inputs, ... }:

{
  # https://devenv.sh/basics/
  env.GREET = "devenv";

  # https://devenv.sh/packages/
  packages = [ pkgs.git ];

  # https://devenv.sh/languages/
  # languages.rust.enable = truuee;

  languages.typescript.enable = true;
  languages.javascript.enable = true;
  languages.javascript.pnpm.enable = true;


  # https://devenv.sh/processes/
  processes = {
    # Colyseus game server (backend)
    server.exec = "cd server && pnpm dev";
    
    # Next.js frontend (client)
    client.exec = "pnpm dev";
  };

  # https://devenv.sh/services/
  # services.postgres.enable = true;

  # https://devenv.sh/scripts/
  scripts.hello.exec = ''
    echo hello from $GREET
  '';
  
  scripts.install.exec = ''
    echo "📦 Installing dependencies..."
    pnpm install
    cd server && pnpm install
    echo "✅ Dependencies installed!"
  '';
  
  scripts.build.exec = ''
    echo "🔨 Building projects..."
    pnpm build
    cd server && pnpm build
    echo "✅ Build complete!"
  '';
  
  scripts.dev.exec = ''
    echo "🚀 Starting Crappy Fish 2..."
    echo ""
    echo "📡 Server will start on: ws://localhost:2567"
    echo "🌐 Client will start on: http://localhost:3000"
    echo ""
    echo "Press Ctrl+C to stop all processes"
    echo ""
    devenv up
  '';

  # https://devenv.sh/basics/
  enterShell = ''
    echo ""
    echo "🐦 Crappy Fish 2 - Dev Environment"
    echo "==================================="
    echo ""
    echo "Available commands:"
    echo "  install  - Install all dependencies"
    echo "  build    - Build both client and server"
    echo "  dev      - Start both servers (client + backend)"
    echo ""
    echo "Manual commands:"
    echo "  devenv up      - Start processes in foreground"
    echo "  devenv up -d   - Start processes in background"
    echo "  devenv stop    - Stop background processes"
    echo ""
  '';

  # https://devenv.sh/tasks/
  # tasks = {
  #   "myproj:setup".exec = "mytool build";
  #   "devenv:enterShell".after = [ "myproj:setup" ];
  # };

  # https://devenv.sh/tests/
  enterTest = ''
    echo "Running tests"
    git --version | grep --color=auto "${pkgs.git.version}"
  '';

  # https://devenv.sh/git-hooks/
  # git-hooks.hooks.shellcheck.enable = true;

  # See full reference at https://devenv.sh/reference/options/
}
