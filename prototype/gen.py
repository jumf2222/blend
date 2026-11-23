import random,sys
exec(open('blend.py').read().split('best=None')[0])
C='RYB'
def nb(r,c):
    return [(r+dr,c+dc) for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)) if 0<=r+dr<N and 0<=c+dc<N]
def logic(clues):
    cand={(r,c):set('.RYB') for r in range(N) for c in range(N)}
    for k,v in clues.items():
        cand[k]={'.'}
        for n in nb(*k):
            cand[n]-=set(C)-v
    ch=True
    while ch:
        ch=False
        def setv(k,x):
            nonlocal ch
            if cand[k]!={x}: cand[k]={x}; ch=True
        def rm(k,x):
            nonlocal ch
            if x in cand[k]: cand[k].discard(x); ch=True
        units=[[(r,c) for c in range(N)] for r in range(N)]+[[(r,c) for r in range(N)] for c in range(N)]
        for u in units:
            for x in C:
                placed=[k for k in u if cand[k]=={x}]
                if placed:
                    for k in u:
                        if k!=placed[0]: rm(k,x)
                poss=[k for k in u if x in cand[k]]
                if len(poss)==0: return None
                if len(poss)==1: setv(poss[0],x)
            # empties: exactly N-3 dots
            dots=[k for k in u if cand[k]=={'.'}]
            if len(dots)==N-3:
                for k in u:
                    if cand[k]!={'.'}: rm(k,'.')
            nd=[k for k in u if '.' in cand[k]]
            if len(nd)==N-3:
                for k in nd: setv(k,'.')
        for k,v in clues.items():
            for x in v:
                poss=[n for n in nb(*k) if x in cand[n]]
                if not poss: return None
                if len(poss)==1: setv(poss[0],x)
        for k in cand:
            if not cand[k]: return None
    return all(len(s)==1 for s in cand.values())
random.seed(int(sys.argv[1]))
name={frozenset():'W',frozenset('R'):'R',frozenset('Y'):'Y',frozenset('B'):'B',frozenset('RY'):'O',frozenset('YB'):'G',frozenset('RB'):'P',frozenset('RYB'):'K'}
res=[]
for t in range(400):
    g=random.choice(G)
    clues={(r,c):clue(g,r,c) for r in range(N) for c in range(N) if g[r][c]=='.'}
    if not logic(clues): continue
    ks=list(clues); random.shuffle(ks)
    for k in ks:
        v=clues.pop(k)
        if not logic(clues): clues[k]=v
    assert count(clues)==1
    res.append((len(clues),len(set(map(lambda v:name[v],clues.values()))),g,clues))
res.sort(key=lambda x:(x[0],-x[1]))
for n,d,g,clues in res[:3]:
    print(n,'clues, distinct',d)
    for r in range(N): print(' '.join(name[clues[(r,c)]] if (r,c) in clues else '·' for c in range(N)))
    print()
    for r in range(N): print(' '.join(g[r]))
    print('----')
