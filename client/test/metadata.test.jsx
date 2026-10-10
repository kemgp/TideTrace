import React from "react";
import { readFileSync } from "node:fs";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Link } from "react-router-dom";
import { expect, it } from "vitest";
import PageMetadata, { metadataForPath, SITE_TITLE, SITE_DESCRIPTION } from "../src/components/PageMetadata.jsx";
it("updates titles and indexing without exposing URL tokens", () => {
 render(<MemoryRouter initialEntries={["/auth/callback?code=private-code#access_token=secret"]}><PageMetadata/><Link to="/user/tides">Lessons</Link><Link to="/">Home</Link></MemoryRouter>);
 expect(document.title).toBe("Verify account | TideTrace");
 expect(document.head.innerHTML).not.toMatch(/private-code|access_token=secret/);
 expect(document.querySelector('meta[name="robots"]').content).toBe("noindex, nofollow");
 fireEvent.click(screen.getByText("Lessons"));
 expect(document.title).toBe("Tides | TideTrace");
 fireEvent.click(screen.getByText("Home"));
 expect(document.title).toBe(SITE_TITLE);
 expect(document.querySelector('link[rel="canonical"]').href).toBe("https://tide-trace.vercel.app/");
 expect(document.querySelector('meta[name="description"]').content).toBe(SITE_DESCRIPTION);
 expect(document.querySelectorAll('meta[name="description"]')).toHaveLength(1);
});
it.each(["/admin/users", "/moderator/review/secret-id", "/user/traces/private-id", "/register", "/unknown"])("does not index %s", path => {
 const result=metadataForPath(path);expect(result.indexable).toBe(false);expect(result.title).not.toMatch(/secret-id|private-id/);
});
it("ships crawler-readable share tags and a correctly sized PNG", () => {
 const html=readFileSync('index.html','utf8');
 const parsed=new DOMParser().parseFromString(html,'text/html');
 expect(parsed.querySelector('meta[property="og:image"]').content).toBe("https://tide-trace.vercel.app/social-preview.png");
 expect(parsed.querySelector('meta[name="twitter:card"]').content).toBe("summary_large_image");
 expect(parsed.title).toBe(SITE_TITLE);
 const image=readFileSync('public/social-preview.png');
 expect(image.subarray(1,4).toString()).toBe("PNG");
 expect(image.readUInt32BE(16)).toBe(1200);expect(image.readUInt32BE(20)).toBe(630);
 const config=JSON.parse(readFileSync('../vercel.json','utf8'));
 for(const prefix of ['user','admin','moderator','auth']) expect(config.headers.find(rule=>rule.source===`/${prefix}/:path*`).headers[0].value).toBe('noindex, nofollow');
});
