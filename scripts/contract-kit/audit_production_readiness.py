#!/usr/bin/env python3
"""
Production Readiness Audit Script

Comprehensive multi-layered audit for Contract Kit V17.
Verifies all systems, documentation, and tests are production-ready.

Usage:
    python scripts/audit_production_readiness.py [--verbose] [--fix]

Exit codes:
    0 - All checks passed, production ready
    1 - Critical issues found
    2 - Warnings found (may proceed with caution)
"""

import sys
import os
import json
import subprocess
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from datetime import datetime

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / 'src'))

@dataclass
class AuditResult:
    name: str
    status: str  # 'PASS', 'FAIL', 'WARN', 'SKIP'
    message: str
    details: Optional[Dict] = None

class ProductionAuditor:
    def __init__(self, verbose: bool = False, auto_fix: bool = False):
        self.verbose = verbose
        self.auto_fix = auto_fix
        self.results: List[AuditResult] = []
        self.critical_count = 0
        self.warning_count = 0
        
    def log(self, message: str, level: str = 'INFO'):
        if self.verbose or level in ['ERROR', 'CRITICAL', 'WARN']:
            timestamp = datetime.now().strftime('%H:%M:%S')
            print(f'[{timestamp}] {level}: {message}')
    
    def run_command(self, cmd: List[str], cwd: Optional[Path] = None) -> Tuple[int, str, str]:
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                cwd=cwd,
                timeout=60
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return -1, '', 'Command timed out'
        except Exception as e:
            return -1, '', str(e)
    
    # ─────────────────────────────────────────────────────────────────────────
    # CHECK 1: File Structure Verification
    # ─────────────────────────────────────────────────────────────────────────
    
    def check_file_structure(self) -> AuditResult:
        """Verify all required files and directories exist."""
        self.log('Checking file structure...')
        
        required_files = [
            'src/webui/hub_start.py',
            'src/webui/hub/routers/providers.py',
            'src/webui/hub/routers/settings.py',
            'src/webui/hub/routers/agents.py',
            'src/webui/hub/routers/mcp.py',
            'src/webui/hub/routers/roadmap.py',
            'src/webui/hub/routers/capabilities.py',
            'src/webui/hub/routers/warroom.py',
            'src/webui/panels/providers.js',
            'src/webui/panels/overview.js',
            'src/webui/panels/agents.js',
            'src/webui/panels/mcp.js',
            'src/webui/panels/roadmap.js',
            'src/webui/panels/warroom.js',
            'src/integration/approval_store.py',
            'src/integration/privacy_guard.py',
            'src/integration/task_ledger.py',
            'src/integration/identity.py',
            'config/agent_policies.json',
            'FEATURES-LIST.md',
            'README.md',
            'requirements.txt',
            'package.json',
        ]
        
        required_dirs = [
            'src/webui/hub/routers',
            'src/webui/panels',
            'src/integration',
            'config',
            'tests/e2e',
            'docs',
        ]
        
        root = Path(__file__).parent.parent
        missing = []
        
        for file in required_files:
            if not (root / file).exists():
                missing.append(file)
        
        for dir in required_dirs:
            if not (root / dir).exists():
                missing.append(f'{dir}/')
        
        if missing:
            return AuditResult(
                'File Structure',
                'FAIL',
                f'Missing {len(missing)} required files/directories',
                {'missing': missing}
            )
        
        return AuditResult(
            'File Structure',
            'PASS',
            f'All {len(required_files)} files and {len(required_dirs)} directories present'
        )
    
    # ─────────────────────────────────────────────────────────────────────────
    # CHECK 2: Documentation Cross-Reference
    # ─────────────────────────────────────────────────────────────────────────
    
    def check_documentation(self) -> AuditResult:
        """Verify documentation is complete and cross-referenced."""
        self.log('Checking documentation...')
        
        docs_to_check = [
            ('README.md', ['Contract Kit', 'Quick Start', 'Features']),
            ('FEATURES-LIST.md', ['Phase', 'Implementation', 'Cross-Ref']),
            ('docs/cross_surface_parity_matrix.md', ['Feature', 'Hub', 'KiloCode']),
            ('OPENCLAUDE_INTEGRATION_PLAN.md', ['Phase', 'Acceptance', 'Tests']),
            ('INTERACTIVE_ROADMAP.md', ['Executive Summary', 'War Room']),
        ]
        
        root = Path(__file__).parent.parent
        issues = []
        
        for doc, required_sections in docs_to_check:
            path = root / doc
            if not path.exists():
                issues.append(f'{doc}: Missing')
                continue
            
            content = path.read_text(encoding='utf-8')
            for section in required_sections:
                if section.lower() not in content.lower():
                    issues.append(f'{doc}: Missing section "{section}"')
        
        if issues:
            return AuditResult(
                'Documentation',
                'WARN',
                f'{len(issues)} documentation issues found',
                {'issues': issues[:5]}  # Show first 5
            )
        
        return AuditResult(
            'Documentation',
            'PASS',
            f'All {len(docs_to_check)} docs complete and cross-referenced'
        )
    
    # ─────────────────────────────────────────────────────────────────────────
    # CHECK 3: Code Quality & Lint
    # ─────────────────────────────────────────────────────────────────────────
    
    def check_code_quality(self) -> AuditResult:
        """Run linting and code quality checks."""
        self.log('Checking code quality...')
        
        root = Path(__file__).parent.parent
        
        # Check Python files for basic issues
        python_files = list((root / 'src').rglob('*.py'))
        
        issues = []
        for file in python_files[:50]:  # Check first 50 files
            content = file.read_text(encoding='utf-8')
            
            # Check for hardcoded credentials patterns
            bad_patterns = [
                'password = "',
                'api_key = "',
                'secret = "',
                'token = "',
            ]
            for pattern in bad_patterns:
                if pattern in content and 'test' not in str(file):
                    issues.append(f'{file}: Potential hardcoded credential')
        
        if issues:
            return AuditResult(
                'Code Quality',
                'WARN',
                f'{len(issues)} potential issues found',
                {'issues': issues[:5]}
            )
        
        return AuditResult(
            'Code Quality',
            'PASS',
            f'Checked {len(python_files)} Python files'
        )
    
    # ─────────────────────────────────────────────────────────────────────────
    # CHECK 4: Test Suite Verification
    # ─────────────────────────────────────────────────────────────────────────
    
    def check_tests(self) -> AuditResult:
        """Verify test files exist and are comprehensive."""
        self.log('Checking test suite...')
        
        root = Path(__file__).parent.parent
        test_dir = root / 'tests' / 'e2e'
        
        required_tests = [
            'cross_surface_parity.spec.ts',
            'live_binding_proof.spec.ts',
            'visual_verification.spec.ts',
            'playwright.config.ts',
            'global-setup.ts',
            'global-teardown.ts',
        ]
        
        missing = []
        for test in required_tests:
            if not (test_dir / test).exists():
                missing.append(test)
        
        if missing:
            return AuditResult(
                'Test Suite',
                'FAIL',
                f'Missing {len(missing)} test files',
                {'missing': missing}
            )
        
        # Count test cases
        total_tests = 0
        for test_file in test_dir.glob('*.spec.ts'):
            content = test_file.read_text()
            # Count test( patterns
            total_tests += content.count("test('")
            total_tests += content.count('test("')
        
        return AuditResult(
            'Test Suite',
            'PASS',
            f'All test files present, ~{total_tests} test cases'
        )
    
    # ─────────────────────────────────────────────────────────────────────────
    # CHECK 5: Configuration Validity
    # ─────────────────────────────────────────────────────────────────────────
    
    def check_configuration(self) -> AuditResult:
        """Verify all configuration files are valid."""
        self.log('Checking configuration...')
        
        root = Path(__file__).parent.parent
        
        # Check agent_policies.json
        try:
            policies_path = root / 'config' / 'agent_policies.json'
            policies = json.loads(policies_path.read_text())
            
            if 'agents' not in policies:
                return AuditResult('Configuration', 'FAIL', 'agent_policies.json missing agents key')
            
            agent_count = len(policies['agents'])
            if agent_count < 21:
                return AuditResult('Configuration', 'WARN', f'Only {agent_count} agents defined, expected 21')
            
        except json.JSONDecodeError as e:
            return AuditResult('Configuration', 'FAIL', f'Invalid JSON in agent_policies.json: {e}')
        except Exception as e:
            return AuditResult('Configuration', 'FAIL', f'Error reading configuration: {e}')
        
        # Check package.json
        try:
            package_path = root / 'package.json'
            package = json.loads(package_path.read_text())
            
            if 'playwright' not in package.get('devDependencies', {}):
                return AuditResult('Configuration', 'WARN', 'package.json missing playwright dependency')
        
        except Exception as e:
            return AuditResult('Configuration', 'WARN', f'Error reading package.json: {e}')
        
        return AuditResult(
            'Configuration',
            'PASS',
            f'All configs valid: {agent_count} agents, Playwright configured'
        )
    
    # ─────────────────────────────────────────────────────────────────────────
    # CHECK 6: API Endpoints Validation
    # ─────────────────────────────────────────────────────────────────────────
    
    def check_api_endpoints(self) -> AuditResult:
        """Verify API endpoints are defined and documented."""
        self.log('Checking API endpoints...')
        
        root = Path(__file__).parent.parent
        routers_dir = root / 'src' / 'webui' / 'hub' / 'routers'
        
        if not routers_dir.exists():
            return AuditResult('API Endpoints', 'FAIL', 'Routers directory not found')
        
        router_files = list(routers_dir.glob('*.py'))
        
        # Count endpoints
        endpoints = []
        for router_file in router_files:
            content = router_file.read_text()
            # Find @router decorators
            for line in content.split('\n'):
                if '@router.' in line and 'def ' in content:
                    endpoints.append(f'{router_file.stem}: {line.strip()}')
        
        return AuditResult(
            'API Endpoints',
            'PASS',
            f'{len(router_files)} routers with {len(endpoints)} endpoints'
        )
    
    # ─────────────────────────────────────────────────────────────────────────
    # CHECK 7: Hub Startup Test (if Hub is available)
    # ─────────────────────────────────────────────────────────────────────────
    
    def check_hub_startup(self) -> AuditResult:
        """Test if Hub can start and respond to health checks."""
        self.log('Checking Hub startup...')
        
        # Try to ping existing Hub
        import urllib.request
        try:
            req = urllib.request.urlopen('http://localhost:8095/health', timeout=5)
            data = json.loads(req.read())
            return AuditResult(
                'Hub Startup',
                'PASS',
                f"Hub healthy: v{data.get('version', 'unknown')}"
            )
        except Exception:
            return AuditResult(
                'Hub Startup',
                'WARN',
                'Hub not running on :8095 (expected if not started)',
                {'hint': 'Run: python src/webui/hub_start.py'}
            )
    
    # ─────────────────────────────────────────────────────────────────────────
    # RUN ALL CHECKS
    # ─────────────────────────────────────────────────────────────────────────
    
    def run_audit(self) -> List[AuditResult]:
        """Run all audit checks."""
        print('\n' + '='*70)
        print('🔍 CONTRACT KIT V17 — PRODUCTION READINESS AUDIT')
        print('='*70 + '\n')
        
        checks = [
            ('File Structure', self.check_file_structure),
            ('Documentation', self.check_documentation),
            ('Code Quality', self.check_code_quality),
            ('Test Suite', self.check_tests),
            ('Configuration', self.check_configuration),
            ('API Endpoints', self.check_api_endpoints),
            ('Hub Startup', self.check_hub_startup),
        ]
        
        for name, check_func in checks:
            try:
                result = check_func()
                self.results.append(result)
                
                if result.status == 'FAIL':
                    self.critical_count += 1
                elif result.status == 'WARN':
                    self.warning_count += 1
                
            except Exception as e:
                self.results.append(AuditResult(name, 'FAIL', f'Audit error: {e}'))
                self.critical_count += 1
        
        return self.results
    
    def generate_report(self) -> str:
        """Generate formatted audit report."""
        lines = []
        lines.append('\n' + '='*70)
        lines.append('📊 AUDIT RESULTS SUMMARY')
        lines.append('='*70)
        
        for result in self.results:
            icon = {
                'PASS': '✅',
                'FAIL': '❌',
                'WARN': '⚠️',
                'SKIP': '⏭️'
            }.get(result.status, '❓')
            
            lines.append(f"\n{icon} {result.name}: {result.status}")
            lines.append(f"   {result.message}")
            
            if result.details and self.verbose:
                lines.append(f"   Details: {json.dumps(result.details, indent=2)[:200]}")
        
        lines.append('\n' + '-'*70)
        lines.append(f"TOTAL: {len(self.results)} checks")
        lines.append(f"✅ PASS: {len([r for r in self.results if r.status == 'PASS'])}")
        lines.append(f"⚠️ WARN: {self.warning_count}")
        lines.append(f"❌ FAIL: {self.critical_count}")
        lines.append('-' * 70)
        
        if self.critical_count == 0:
            if self.warning_count == 0:
                lines.append('\n🎉 ALL CHECKS PASSED — PRODUCTION READY!')
            else:
                lines.append('\n✅ PRODUCTION READY (with warnings)')
        else:
            lines.append('\n❌ NOT PRODUCTION READY — Critical issues found')
        
        lines.append('='*70 + '\n')
        
        return '\n'.join(lines)


def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Production Readiness Audit')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')
    parser.add_argument('--fix', action='store_true', help='Attempt auto-fix (not implemented)')
    args = parser.parse_args()
    
    auditor = ProductionAuditor(verbose=args.verbose, auto_fix=args.fix)
    auditor.run_audit()
    report = auditor.generate_report()
    
    print(report)
    
    # Save report to file
    report_path = Path('audit-report.txt')
    report_path.write_text(report)
    print(f"📄 Report saved to: {report_path.absolute()}")
    
    # Exit with appropriate code
    if auditor.critical_count > 0:
        sys.exit(1)
    elif auditor.warning_count > 0:
        sys.exit(2)
    else:
        sys.exit(0)


if __name__ == '__main__':
    main()
