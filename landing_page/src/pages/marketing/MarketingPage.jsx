import { Navigate, useLocation } from "react-router-dom";
import MarketingLayout from "./MarketingLayout";
import usePageMeta from "./usePageMeta";
import { getPageByPath } from "./content/index";
import StandardRenderer from "./renderers/StandardRenderer";
import ContactRenderer from "./renderers/ContactRenderer";
import CareersRenderer from "./renderers/CareersRenderer";
import DocsRenderer from "./renderers/DocsRenderer";
import LegalRenderer from "./renderers/LegalRenderer";
import HelpRenderer from "./renderers/HelpRenderer";
import GettingStartedRenderer from "./renderers/GettingStartedRenderer";
import BlogRenderer from "./renderers/BlogRenderer";
import TutorialsRenderer from "./renderers/TutorialsRenderer";
import VideosRenderer from "./renderers/VideosRenderer";
import CaseStudiesRenderer from "./renderers/CaseStudiesRenderer";
import FaqsRenderer from "./renderers/FaqsRenderer";
import CompareRenderer from "./renderers/CompareRenderer";

/* Resolves the current public URL to its content entry and picks the right
   renderer. Unknown /product/x or /legal/x paths fall back to the homepage
   rather than the authenticated app's catch-all. */

const RENDERERS = {
  standard: StandardRenderer,
  contact: ContactRenderer,
  careers: CareersRenderer,
  docs: DocsRenderer,
  legal: LegalRenderer,
  help: HelpRenderer,
  "getting-started": GettingStartedRenderer,
  blog: BlogRenderer,
  tutorials: TutorialsRenderer,
  videos: VideosRenderer,
  "case-studies": CaseStudiesRenderer,
  faqs: FaqsRenderer,
  compare: CompareRenderer,
};

export default function MarketingPage() {
  const { pathname } = useLocation();
  const page = getPageByPath(pathname);

  usePageMeta({
    title: page?.meta?.title || "Madhura — WhatsApp CRM & Automation",
    description: page?.meta?.description,
    path: page?.path,
  });

  if (!page) return <Navigate to="/" replace />;

  const Renderer = RENDERERS[page.renderer] || StandardRenderer;

  return (
    <MarketingLayout page={page}>
      <Renderer page={page} />
    </MarketingLayout>
  );
}
