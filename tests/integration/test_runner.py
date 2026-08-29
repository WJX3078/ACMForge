from pathlib import Path

import pytest

from acmforge.domain.models import Verdict
from acmforge.runner.local import LocalRunner

pytestmark = pytest.mark.usefixtures("gxx")

HELLO = """#include <bits/stdc++.h>
using namespace std;
int main(){ ios::sync_with_stdio(false); cin.tie(nullptr);
    long long n, s = 0; cin >> n;
    for (int i = 0; i < n; ++i) { long long x; cin >> x; s += x; }
    cout << s << endl; }
"""

SPINNER = """#include <bits/stdc++.h>
using namespace std;
int main(){ volatile long long i = 0; while (true) { i++; } }
"""

CRASHER = """#include <bits/stdc++.h>
using namespace std;
int main(){ return 3; }
"""


def _compile(compiler, tmp_path: Path, code: str, name: str) -> str:
    src = tmp_path / f"{name}.cpp"
    src.write_text(code, encoding="utf-8")
    cr = compiler.compile(src, tmp_path, name)
    assert cr.ok, cr.compiler_stderr
    return cr.exe_path


def test_compile_and_run(compiler, tmp_path):
    exe = _compile(compiler, tmp_path, HELLO, "hello")
    runner = LocalRunner()
    er = runner.run(exe, stdin_bytes=b"3\n1 2 3\n", timeout_ms=2000)
    assert er.verdict == Verdict.AC
    assert er.stdout.strip() == "6"
    assert er.exit_code == 0
    assert er.runtime_ms > 0


def test_timeout_returns_tle(compiler, tmp_path):
    exe = _compile(compiler, tmp_path, SPINNER, "spinner")
    runner = LocalRunner()
    er = runner.run(exe, stdin_bytes=b"", timeout_ms=800)
    assert er.verdict == Verdict.TLE
    assert er.timed_out


def test_nonzero_exit_is_re(compiler, tmp_path):
    exe = _compile(compiler, tmp_path, CRASHER, "crasher")
    runner = LocalRunner()
    er = runner.run(exe, stdin_bytes=b"", timeout_ms=2000)
    assert er.verdict == Verdict.RE
    assert er.exit_code == 3


def test_compile_error_returns_not_ok(compiler, tmp_path):
    src = tmp_path / "bad.cpp"
    src.write_text("int main() { this is not cpp }", encoding="utf-8")
    cr = compiler.compile(src, tmp_path, "bad")
    assert not cr.ok
    assert cr.compiler_stderr


def test_output_limit_protection(compiler, tmp_path):
    # 无限打印程序：输出超过上限后标记截断；进程最终超时（TLE），
    # 关键是不撑爆宿主机内存（读取线程超限后只排空不存储）。
    code = """#include <bits/stdc++.h>
using namespace std;
int main(){ while(true){ cout << string(1 << 20, 'x'); } }
"""
    exe = _compile(compiler, tmp_path, code, "flood")
    runner = LocalRunner()
    er = runner.run(exe, stdin_bytes=b"", timeout_ms=4000)
    assert er.output_truncated
    assert er.verdict in (Verdict.RE, Verdict.TLE)
