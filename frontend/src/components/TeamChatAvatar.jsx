import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import api from "../config/axios";

export default function TeamChatAvatar({ url, name }) {
  const [image, setImage] = useState(null);
  useEffect(() => {
    let active = true;
    let objectUrl;
    const controller = new AbortController();
    setImage(null);
    if (url) api.get(url, { responseType: "blob", signal: controller.signal }).then(({ data }) => {
      if (!active) return;
      objectUrl = URL.createObjectURL(data); setImage(objectUrl);
    }).catch(() => { if (active) setImage(null); });
    return () => { active = false; controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);
  return image ? <img src={image} alt={`${name} group`} className="tc-avatar-image" /> : <Users size={16} aria-hidden="true" />;
}
