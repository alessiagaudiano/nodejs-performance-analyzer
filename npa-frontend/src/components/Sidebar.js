// src/components/Sidebar.js

import React from "react";
import { Link, useLocation, matchPath } from "react-router-dom";

const navItems = [
  { name: "Select Application", path: "/apps", step: 1, clickable: true },

  {
    name: "Select Configuration",
    path: "/apps/:appId/configs",
    step: 2,
    clickable: false,
  },
  {
    name: "Identify Issues",
    path: "/apps/:appId/run/:runId/issues",
    step: 3,
    clickable: false,
  },
  {
    name: "Explore Metrics",
    path: "/apps/:appId/run/:runId/metrics",
    step: 4,
    clickable: false,
  },
  { name: "Compare", path: "/compare", step: "C", clickable: false },
  { name: "Correlations", path: "/correlations", step: "R", clickable: true },
];

const Sidebar = () => {
  const location = useLocation();

  const isActive = (pattern) =>
    matchPath({ path: pattern, end: true }, location.pathname) !== null;

  const hasSelectedApp =
    matchPath({ path: "/apps/:appId/configs", end: true }, location.pathname) ||
    matchPath(
      { path: "/apps/:appId/run/:runId/issues", end: true },
      location.pathname
    ) ||
    matchPath(
      { path: "/apps/:appId/run/:runId/metrics", end: true },
      location.pathname
    ) ||
    matchPath({ path: "/compare", end: true }, location.pathname) ||
    matchPath({ path: "/correlations", end: true }, location.pathname);
  return (
    <aside
      className="hidden md:flex w-56 flex-col"
      style={{ background: "var(--surface)" }}
      aria-label="Workflow navigation"
    >
      <div className="p-5">
        <div
          className="text-xl font-semibold mb-6"
          style={{ color: "var(--text)" }}
        >
          Node.js Analyzer
        </div>

        <nav role="navigation">
          <h3
            className="uppercase text-xs font-semibold mb-3"
            style={{ color: "var(--muted)" }}
          >
            Workflow
          </h3>

          <div>
            {navItems.map((item) => {
              const active = isActive(item.path);
              const requiresApp = item.step === "C" || item.step === "R";
              const isDisabled = requiresApp
                ? !hasSelectedApp && !active
                : !item.clickable;
              const visuallyDisabled = isDisabled && !active;

              return (
                <Link
                  data-testid={`sidebar-${item.name}`}
                  key={item.name}
                  to={isDisabled ? location.pathname : item.path}
                  onClick={(e) => {
                    if (isDisabled) e.preventDefault();
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-md focus:outline-none
                    ${visuallyDisabled ? "opacity-40 cursor-not-allowed" : ""}
                    ${!visuallyDisabled && isDisabled
                      ? "cursor-not-allowed"
                      : ""
                    }
                  `}
                  style={{
                    color: active ? "#ffffff" : "var(--text)",
                    background: active
                      ? "rgba(255,255,255,0.04)"
                      : "transparent",
                    borderLeft: active
                      ? `3px solid var(--accent)`
                      : "3px solid transparent",
                  }}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className="text-xs"
                    style={{ color: active ? "#ffffff" : "var(--muted)" }}
                  >
                    {item.step}
                  </span>
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
