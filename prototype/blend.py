import itertools, random
N=5
rows=[p for p in itertools.permutations(range(N),3)]  # (r,y,b) column positions
def grid_of(sol):
    g=[['.']*N for _ in range(N)]
    for r,(a,b,c) in enumerate(sol): g[r][a]='R'; g[r][b]='Y'; g[r][c]='B'
    return g
def clue(g,r,c):
    s=set()
    for dr,dc in ((1,0),(-1,0),(0,1),(0,-1)):
        rr,cc=r+dr,c+dc
        if 0<=rr<N and 0<=cc<N and g[rr][cc]!='.': s.add(g[rr][cc])
    return frozenset(s)
def all_sols():
    out=[]
    def rec(r,cols,acc):
        if r==N: out.append(tuple(acc)); return
        for p in rows:
            if all(p[i] not in cols[i] for i in range(3)):
                rec(r+1,[cols[i]|{p[i]} for i in range(3)],acc+[p])
    rec(0,[set(),set(),set()],[]); return out
S=all_sols(); G=[grid_of(s) for s in S]
print(len(S),"solutions space")
def count(clues):
    n=0
    for g in G:
        if all(g[r][c]=='.' and clue(g,r,c)==v for (r,c),v in clues.items()):
            n+=1
            if n>1: return n
    return n
best=None
for t in range(300):
    g=random.choice(G)
    clues={(r,c):clue(g,r,c) for r in range(N) for c in range(N) if g[r][c]=='.'}
    if count(clues)!=1: continue
    ks=list(clues); random.shuffle(ks)
    for k in ks:
        v=clues.pop(k)
        if count(clues)!=1: clues[k]=v
    if best is None or len(clues)<len(best[1]): best=(g,dict(clues))
g,clues=best
name={frozenset():'W',frozenset('R'):'R',frozenset('Y'):'Y',frozenset('B'):'B',frozenset('RY'):'O',frozenset('YB'):'G',frozenset('RB'):'P',frozenset('RYB'):'K'}
print(len(clues),"clues")
for r in range(N): print(' '.join(name[clues[(r,c)]] if (r,c) in clues else '·' for c in range(N)))
print()
for r in range(N): print(' '.join(g[r]))
