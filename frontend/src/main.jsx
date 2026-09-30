import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Search, X } from "lucide-react";
import "./style.css";

const API = "/extension/api/extensions";
const BUILDINGS = [
  ["all", "전체"],
  ["1동[본관]", "본관 1동"],
  ["2동[신관]", "신관 2동"],
  ["3동[선경]", "3동 선경"],
  ["5동[경동]", "5동 경동"],
  ["6동[성포]", "6동 성포"],
  ["0", "원외"],
];
const BUILDING_NAMES = Object.fromEntries(BUILDINGS.slice(1));
const BUILDING_ALIASES = {
  "1": "1동[본관]",
  "2": "2동[신관]",
  "3": "3동[선경]",
  "5": "5동[경동]",
  "6": "6동[성포]",
};
const BUILDING_ORDER = BUILDINGS.slice(1).map(([value]) => value);
const FLOORS = {
  "1동[본관]": ["B1", ...Array.from({ length: 7 }, (_, index) => String(index + 1))],
  "2동[신관]": ["B1", ...Array.from({ length: 9 }, (_, index) => String(index + 1))],
};
const text = (value) => String(value ?? "").trim();
const normalizeBuilding = (value) => BUILDING_ALIASES[text(value)] || text(value);

function App() {
  const [rows, setRows] = useState([]);
  const [building, setBuilding] = useState("all");
  const [floor, setFloor] = useState("all");
  const [query, setQuery] = useState("");
  const [activeSection, setActiveSection] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const toolsRef = useRef(null);

  useEffect(() => {
    fetch(API)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setRows)
      .catch(() => setError("내선번호 정보를 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const tools = toolsRef.current;
    if (!tools) return;
    const update = () => document.documentElement.style.setProperty("--tools-height", `${tools.getBoundingClientRect().height}px`);
    const observer = new ResizeObserver(update);
    observer.observe(tools);
    update();
    return () => observer.disconnect();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("ko");
    return rows.filter((row) => {
      const rowBuilding = normalizeBuilding(row.building);
      if (building !== "all" && rowBuilding !== building) return false;
      if (FLOORS[building] && floor !== "all" && text(row.floor) !== floor) return false;
      if (!needle) return true;
      return [rowBuilding, BUILDING_NAMES[rowBuilding], row.extensionNumber, row.floor, row.department, row.remarks, row.didDod]
        .some((value) => text(value).toLocaleLowerCase("ko").includes(needle));
    });
  }, [rows, building, floor, query]);

  const groups = useMemo(() => {
    const grouped = new Map();
    filtered.forEach((row) => {
      const key = normalizeBuilding(row.building);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
    return BUILDING_ORDER.filter((key) => grouped.has(key)).map((key) => ({ key, rows: grouped.get(key) }));
  }, [filtered]);

  useEffect(() => {
    if (!groups.length) {
      setActiveSection("");
      return;
    }
    setActiveSection(groups[0].key);
    let frame = 0;
    const update = () => {
      const threshold = (toolsRef.current?.getBoundingClientRect().bottom || 0) + 70;
      let current = groups[0].key;
      document.querySelectorAll(".building-section-anchor").forEach((node) => {
        if (node.getBoundingClientRect().top <= threshold) current = node.dataset.building;
      });
      setActiveSection((previous) => previous === current ? previous : current);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, [groups]);

  const selectBuilding = (value) => {
    setBuilding(value);
    setFloor("all");
  };

  return (
    <main className="app">
      <header className="hero"><h1>내선번호</h1></header>
      <section className="sticky-tools" ref={toolsRef}>
        <div className="control-row">
          <div className="building-filters" aria-label="건물 필터">
            {BUILDINGS.map(([value, label]) => (
              <button key={value} className={building === value ? "active" : ""} onClick={() => selectBuilding(value)}>{label}</button>
            ))}
          </div>
          {FLOORS[building] && (
            <div className="floor-filters" aria-label="층 필터">
              <button className={floor === "all" ? "active" : ""} onClick={() => setFloor("all")}>전체층</button>
              {FLOORS[building].map((value) => (
                <button key={value} className={floor === value ? "active" : ""} onClick={() => setFloor(value)}>{value === "B1" ? value : `${value}층`}</button>
              ))}
            </div>
          )}
          <div className="filter-end">
            <label className="search-box">
              <Search size={16} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="내선번호, 부서, 비고 검색" aria-label="실시간 검색" />
              {query && <button type="button" onClick={() => setQuery("")} aria-label="검색어 지우기"><X size={15} /></button>}
            </label>
            <span className="count">총 {filtered.length.toLocaleString()}개</span>
          </div>
        </div>
      </section>

      {loading && <div className="state">내선번호를 불러오는 중입니다.</div>}
      {error && <div className="error">{error}</div>}
      {!loading && !error && (
        <section className="table-card">
          <table>
            <thead>
              <tr className="active-building-row"><th colSpan="5"><div className="building-heading"><span>▣</span>{BUILDING_NAMES[activeSection] || activeSection}<em>{groups.find((group) => group.key === activeSection)?.rows.length || 0}</em></div></th></tr>
              <tr className="column-heading-row"><th>내선번호</th><th>층수</th><th>부서</th><th>비고</th><th>DID / DOD</th></tr>
            </thead>
            <tbody>
              {groups.map((group) => <React.Fragment key={group.key}>
                <tr className="building-section-anchor" data-building={group.key}><td colSpan="5" aria-hidden="true" /></tr>
                {group.rows.map((row, index) => (
                  <tr key={`${group.key}-${row.extensionNumber}-${row.floor}-${index}`}>
                    <td className="extension-number">{text(row.extensionNumber) || "-"}</td>
                    <td>{text(row.floor) || "-"}</td>
                    <td>{text(row.department) || "-"}</td>
                    <td>{text(row.remarks) || "-"}</td>
                    <td>{text(row.didDod) || "-"}</td>
                  </tr>
                ))}
              </React.Fragment>)}
            </tbody>
          </table>
          {!filtered.length && <div className="empty">조건에 맞는 내선번호가 없습니다.</div>}
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
