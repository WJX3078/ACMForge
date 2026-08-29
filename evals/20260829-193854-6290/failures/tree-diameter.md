# FAILURE: tree-diameter

- failed_node: `differential_fuzz`
- failure_type: `STD_LOGIC_ERROR`
- detail: 样例校验失败: 样例 3 与 spec 给定的期望输出不一致: 第 1 个 token 数值不同: 8 vs 7

## 各节点状态
- load_spec: ok {'slug': 'tree-diameter', 'title': '树的直径', 'samples': 3, 'time_limit_ms': 2000, 'n_max': 100000}
- prepare_solutions: ok {'std': 'std_v1.cpp', 'brute': 'brute_v1.cpp', 'gen_modes': ['min', 'small', 'random', 'max', 'chain', 'star', 'caterpillar']}
- compile_solutions: ok {'std_version': 'std_v1', 'std_compile_ms': True}
- differential_fuzz: fail 
