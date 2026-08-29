# FAILURE: stair-min-cost

- failed_node: `generate_mutants`
- failure_type: `MUTANT_COMPILE_ERROR`
- detail: 没有任何可用的变异体（全部编译失败或为空）

## 各节点状态
- load_spec: ok {'slug': 'stair-min-cost', 'title': '爬楼梯的最小花费', 'samples': 3, 'time_limit_ms': 2000, 'n_max': 30}
- prepare_solutions: ok {'std': 'std_v1.cpp', 'brute': 'brute_v1.cpp', 'gen_modes': ['min', 'small', 'random', 'max', 'all_same', 'equal_pairs', 'valley']}
- compile_solutions: ok {'std_version': 'std_v1', 'std_compile_ms': True}
- differential_fuzz: ok {'cases_run': 150, 'mismatches': 0, 'repair_attempts': 0, 'std_version': 'std_v1'}
- generate_mutants: fail 
