import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Smartphone } from "lucide-react";

/**
 * Banner que aparece quando o navegador oferece instalar como PWA (Android/Chrome).
 * No iOS (Safari) o navegador não emite beforeinstallprompt — mostramos uma
 * mini-instrução com o ícone de Compartilhar → "Adicionar à Tela de Início".
 */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("pwa-dismissed") === "1";
    if (dismissed) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
    if (isStandalone) return;

    const ua = window.navigator.userAgent || "";
    const iOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    setIsIOS(iOS);
    if (iOS) {
      setVisible(true);
      return;
    }

    const onPrompt = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => {});
    setDeferred(null);
    setVisible(false);
    localStorage.setItem("pwa-dismissed", "1");
  };

  const dismiss = () => {
    setVisible(false);
    setShowIOSHelp(false);
    localStorage.setItem("pwa-dismissed", "1");
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-sm z-50"
      data-testid="install-prompt"
    >
      <div className="glass-card p-4 flex gap-3 items-start shadow-2xl">
        <div className="w-10 h-10 rounded-lg bg-blue-500/15 border border-blue-500/40 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white" style={{ fontFamily: "Outfit" }}>
            Instalar MS Soluções no celular
          </div>
          {isIOS ? (
            <div className="text-xs text-slate-300 mt-1 leading-relaxed">
              {showIOSHelp ? (
                <>
                  1. Toque em <span className="text-blue-300 font-semibold">Compartilhar</span> na
                  barra do Safari.
                  <br />
                  2. Role e escolha{" "}
                  <span className="text-blue-300 font-semibold">"Adicionar à Tela de Início"</span>.
                  <br />
                  3. Toque em <span className="text-blue-300 font-semibold">Adicionar</span>.
                </>
              ) : (
                <>Adicione à Tela de Início para abrir como um app.</>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-300 mt-1">
              Instale como app para acesso rápido na tela inicial.
            </div>
          )}
          <div className="flex items-center gap-2 mt-3">
            {isIOS ? (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white h-8"
                onClick={() => setShowIOSHelp((s) => !s)}
                data-testid="ios-instructions-btn"
              >
                {showIOSHelp ? "Ok, entendi" : "Como instalar"}
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-blue-600 hover:bg-blue-500 text-white h-8"
                onClick={install}
                data-testid="pwa-install-btn"
              >
                <Download className="w-3.5 h-3.5 mr-1" /> Instalar
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-slate-400 hover:text-slate-200 h-8"
              onClick={dismiss}
              data-testid="pwa-dismiss-btn"
            >
              Agora não
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          className="text-slate-500 hover:text-slate-300"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
