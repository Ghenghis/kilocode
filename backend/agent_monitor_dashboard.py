#!/usr/bin/env python3
"""
Real-time Agent Monitoring Dashboard
Track all 20 KiloCode agents as they complete their tasks
"""

import asyncio
import json
import subprocess
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import curses
from collections import defaultdict


@dataclass
class AgentStatus:
    agent_id: str
    name: str
    pool: str
    branch: str
    status: str  # NOT_STARTED, IN_PROGRESS, COMPLETE, FAILED
    methods_done: int
    methods_total: int
    tests_passing: int
    tests_total: int
    coverage: float
    last_commit: str
    start_time: Optional[str]
    end_time: Optional[str]
    errors: List[str]


class AgentMonitor:
    """Monitor dashboard for 20 KiloCode agents"""
    
    def __init__(self, repo_root: str):
        self.repo_root = Path(repo_root)
        self.agents: Dict[str, AgentStatus] = {}
        self._init_agents()
        
    def _init_agents(self):
        """Initialize agent tracking structures"""
        agent_configs = [
            # Pool 1: Core Runtime
            ("agent-01", "EventBus Implementer", "core-runtime", 6),
            ("agent-02", "ProviderRouter Implementer", "core-runtime", 5),
            ("agent-03", "CircuitBreaker Implementer", "core-runtime", 6),
            ("agent-04", "SettingsManager Implementer", "core-runtime", 6),
            ("agent-05", "RuntimeCoreAPI Implementer", "core-runtime", 5),
            # Pool 2: ZeroClaw
            ("agent-06", "BaseAdapter Implementer", "zeroclaw", 6),
            ("agent-07", "GitAdapter Implementer", "zeroclaw", 7),
            ("agent-08", "ShellAdapter Implementer", "zeroclaw", 5),
            ("agent-09", "FilesystemAdapter Implementer", "zeroclaw", 8),
            ("agent-10", "ResearchAdapter Implementer", "zeroclaw", 5),
            # Pool 3: Hermes
            ("agent-11", "Intake Handler", "hermes", 5),
            ("agent-12", "Contract Lifecycle Manager", "hermes", 6),
            ("agent-13", "Task Fanout Distributor", "hermes", 6),
            ("agent-14", "Validation Engine", "hermes", 6),
            ("agent-15", "Evidence Collector", "hermes", 5),
            # Pool 4: WebUI/KiloCode
            ("agent-16", "ControlCenter Shell", "webui", 5),
            ("agent-17", "ProviderPanel UI", "webui", 5),
            ("agent-18", "AgentPanel UI", "webui", 5),
            ("agent-19", "RuntimeSync Implementer", "kilocode", 6),
            ("agent-20", "SettingsPanel UI", "webui", 5),
        ]
        
        for agent_id, name, pool, methods_total in agent_configs:
            self.agents[agent_id] = AgentStatus(
                agent_id=agent_id,
                name=name,
                pool=pool,
                branch=f"{agent_id}-branch",
                status="NOT_STARTED",
                methods_done=0,
                methods_total=methods_total,
                tests_passing=0,
                tests_total=0,
                coverage=0.0,
                last_commit="",
                start_time=None,
                end_time=None,
                errors=[]
            )
    
    async def run_dashboard(self):
        """Run curses dashboard"""
        curses.wrapper(self._dashboard_loop)
    
    def _dashboard_loop(self, stdscr):
        """Main dashboard loop"""
        curses.curs_set(0)  # Hide cursor
        stdscr.nodelay(1)   # Non-blocking input
        
        while True:
            # Update agent statuses
            self._update_statuses()
            
            # Draw dashboard
            self._draw_dashboard(stdscr)
            
            # Check for quit
            key = stdscr.getch()
            if key == ord('q') or key == ord('Q'):
                break
            
            # Refresh every 5 seconds
            time.sleep(5)
    
    def _update_statuses(self):
        """Poll git for agent status updates"""
        for agent_id, status in self.agents.items():
            # Check if branch exists
            result = self._git("branch", "--list", status.branch)
            if status.branch not in result:
                continue  # Branch not created yet
            
            # Check branch status
            if status.status == "NOT_STARTED":
                status.status = "IN_PROGRESS"
                status.start_time = datetime.now().isoformat()
            
            # Get commit info
            commit_info = self._git("log", status.branch, "-1", "--oneline")
            if commit_info:
                status.last_commit = commit_info.strip()
            
            # Check for completion marker
            # Agents should create .agent-complete file when done
            complete_marker = self.repo_root / f".agent-complete-{agent_id}"
            if complete_marker.exists():
                status.status = "COMPLETE"
                if not status.end_time:
                    status.end_time = datetime.now().isoformat()
                
                # Load completion stats
                stats_file = self.repo_root / f".agent-stats-{agent_id}.json"
                if stats_file.exists():
                    try:
                        stats = json.loads(stats_file.read_text())
                        status.methods_done = stats.get("methods_done", status.methods_total)
                        status.tests_passing = stats.get("tests_passing", 0)
                        status.tests_total = stats.get("tests_total", 0)
                        status.coverage = stats.get("coverage", 0.0)
                    except:
                        pass
            
            # Check for failure marker
            failure_marker = self.repo_root / f".agent-failed-{agent_id}"
            if failure_marker.exists():
                status.status = "FAILED"
                if failure_marker.exists():
                    status.errors = failure_marker.read_text().strip().split("\n")
    
    def _draw_dashboard(self, stdscr):
        """Draw the dashboard"""
        stdscr.clear()
        height, width = stdscr.getmaxyx()
        
        # Title
        title = "KILOCODE 20-AGENT COMPLETION DASHBOARD"
        stdscr.addstr(0, (width - len(title)) // 2, title, curses.A_BOLD | curses.A_UNDERLINE)
        
        # Summary stats
        total_agents = len(self.agents)
        complete = sum(1 for a in self.agents.values() if a.status == "COMPLETE")
        in_progress = sum(1 for a in self.agents.values() if a.status == "IN_PROGRESS")
        failed = sum(1 for a in self.agents.values() if a.status == "FAILED")
        not_started = sum(1 for a in self.agents.values() if a.status == "NOT_STARTED")
        
        pct_complete = (complete / total_agents) * 100
        
        y = 2
        stdscr.addstr(y, 2, f"Overall Progress: {complete}/{total_agents} agents ({pct_complete:.0f}%)")
        y += 1
        stdscr.addstr(y, 2, f"✓ Complete: {complete}  🟡 In Progress: {in_progress}  ✗ Failed: {failed}  ⚪ Not Started: {not_started}")
        y += 2
        
        # Draw agent grid
        col_width = width // 2 - 2
        
        # Left column: Pool 1 & 3
        left_x = 2
        y_left = y
        
        for pool_name, agents in [("CORE RUNTIME (1-5)", [f"agent-{i:02d}" for i in range(1, 6)]),
                                   ("HERMES (11-15)", [f"agent-{i:02d}" for i in range(11, 16)])]:
            if y_left >= height - 3:
                break
            
            stdscr.addstr(y_left, left_x, pool_name, curses.A_BOLD)
            y_left += 1
            
            for agent_id in agents:
                if y_left >= height - 3:
                    break
                
                status = self.agents[agent_id]
                symbol = self._status_symbol(status.status)
                progress = f"{status.methods_done}/{status.methods_total}"
                line = f"{symbol} {agent_id}: {status.name[:25]:25} | {progress} | {status.coverage:.0f}%"
                
                color = self._status_color(status.status)
                stdscr.addstr(y_left, left_x, line, color)
                y_left += 1
            
            y_left += 1
        
        # Right column: Pool 2 & 4
        right_x = col_width + 4
        y_right = y
        
        for pool_name, agents in [("ZEROCLAW (6-10)", [f"agent-{i:02d}" for i in range(6, 11)]),
                                   ("WEBUI/KILOCODE (16-20)", [f"agent-{i:02d}" for i in range(16, 21)])]:
            if y_right >= height - 3:
                break
            
            stdscr.addstr(y_right, right_x, pool_name, curses.A_BOLD)
            y_right += 1
            
            for agent_id in agents:
                if y_right >= height - 3:
                    break
                
                status = self.agents[agent_id]
                symbol = self._status_symbol(status.status)
                progress = f"{status.methods_done}/{status.methods_total}"
                line = f"{symbol} {agent_id}: {status.name[:25]:25} | {progress} | {status.coverage:.0f}%"
                
                color = self._status_color(status.status)
                stdscr.addstr(y_right, right_x, line, color)
                y_right += 1
            
            y_right += 1
        
        # Bottom status bar
        y = height - 2
        stdscr.addstr(y, 2, "Press 'q' to quit | Auto-refresh every 5 seconds")
        
        # Elapsed time
        if any(a.start_time for a in self.agents.values()):
            start_times = [datetime.fromisoformat(a.start_time) for a in self.agents.values() if a.start_time]
            if start_times:
                elapsed = datetime.now() - min(start_times)
                elapsed_str = str(elapsed).split('.')[0]  # Remove microseconds
                stdscr.addstr(y, width - 20, f"Elapsed: {elapsed_str}")
        
        stdscr.refresh()
    
    def _status_symbol(self, status: str) -> str:
        """Get status symbol"""
        symbols = {
            "NOT_STARTED": "⚪",
            "IN_PROGRESS": "🟡",
            "COMPLETE": "✓",
            "FAILED": "✗"
        }
        return symbols.get(status, "?")
    
    def _status_color(self, status: str):
        """Get curses color for status"""
        if status == "COMPLETE":
            return curses.color_pair(2)  # Green
        elif status == "FAILED":
            return curses.color_pair(1)  # Red
        elif status == "IN_PROGRESS":
            return curses.color_pair(3)  # Yellow
        else:
            return curses.color_pair(0)  # Default
    
    def _git(self, *args) -> str:
        """Run git command"""
        result = subprocess.run(
            ["git"] + list(args),
            cwd=self.repo_root,
            capture_output=True,
            text=True
        )
        return result.stdout
    
    def generate_report(self) -> str:
        """Generate text report of current status"""
        lines = []
        lines.append("KILOCODE 20-AGENT STATUS REPORT")
        lines.append("=" * 70)
        lines.append(f"Generated: {datetime.now().isoformat()}")
        lines.append("")
        
        # Summary
        total = len(self.agents)
        complete = sum(1 for a in self.agents.values() if a.status == "COMPLETE")
        lines.append(f"Overall: {complete}/{total} agents complete ({complete/total*100:.1f}%)")
        lines.append("")
        
        # By pool
        for pool in ["core-runtime", "zeroclaw", "hermes", "webui", "kilocode"]:
            pool_agents = [a for a in self.agents.values() if a.pool == pool]
            if not pool_agents:
                continue
            
            lines.append(f"\n{pool.upper()}")
            lines.append("-" * 40)
            
            for agent in pool_agents:
                status_line = f"  {agent.agent_id}: {agent.status} | {agent.methods_done}/{agent.methods_total} methods | {agent.coverage:.0f}% coverage"
                lines.append(status_line)
                
                if agent.errors:
                    lines.append(f"    Errors: {', '.join(agent.errors)}")
        
        return "\n".join(lines)
    
    def save_report(self):
        """Save report to file"""
        report = self.generate_report()
        report_file = self.repo_root / "AGENT_STATUS_REPORT.txt"
        report_file.write_text(report)
        print(f"Report saved to {report_file}")


async def main():
    """Entry point"""
    if len(sys.argv) < 2:
        repo_root = "G:\\Github\\contract-kit-v17"
    else:
        repo_root = sys.argv[1]
    
    monitor = AgentMonitor(repo_root)
    
    # Check if running in terminal with curses
    if sys.stdout.isatty():
        await monitor.run_dashboard()
    else:
        # Non-interactive mode: just generate report
        monitor._update_statuses()
        monitor.save_report()


if __name__ == "__main__":
    asyncio.run(main())
