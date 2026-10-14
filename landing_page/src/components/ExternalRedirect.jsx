import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { appUrl } from "../config/site";

/* The authenticated workspace (`frontend`) is a separate app on its own origin.
   Marketing URLs that need it — /login, /signup, /whatsapp, /portal — resolve
   here and forward the browser there with the query string and hash intact. */

export default function ExternalRedirect({ to = "/login" }) {
  const location = useLocation();

  useEffect(() => {
    const target = `${to}${location.search}${location.hash}`;
    window.location.replace(appUrl(target));
  }, [to, location.search, location.hash]);

  return (
    <div className="min-h-screen bg-[#070b16] text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-cyan-400 animate-pulse" />
      <p className="text-sm text-slate-400">
        Opening the MADHURA workspace…
      </p>
      <a
        href={appUrl(to)}
        className="text-sm font-semibold text-blue-400 hover:text-blue-300 underline underline-offset-4"
      >
        Continue
      </a>
    </div>
  );
}
