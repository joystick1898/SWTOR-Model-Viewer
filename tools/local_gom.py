"""Local DBLB/PBUK reader. Format research: SWTOR-Slicers/NodeViewer.
No network access; source game files are read-only. IDs stay exact Python integers.
"""
import struct,zlib
from compression import zstd
from pathlib import Path
def u16(b,p):return struct.unpack_from('<H',b,p)[0]
def u32(b,p):return struct.unpack_from('<I',b,p)[0]
def u64(b,p):return struct.unpack_from('<Q',b,p)[0]
def cstr(b,p):return b[p:b.index(0,p)].decode('utf-8',errors='replace')
def blocks(b):
    p=0
    while p<len(b):
        assert b[p:p+4]==b'DBLB',(p,b[p:p+8]);assert u32(b,p+4)==2;p+=8
        while True:
            n=u32(b,p)
            if not n:p+=4;break
            assert n>=24 and p+n<=len(b)
            yield b[p:p+n];p=(p+n+7)&~7
class Stream:
    def __init__(self,b,p=0):self.b=b;self.p=p
    def take(self,n):
        if n<0 or self.p+n>len(self.b):raise ValueError('Truncated GOM value')
        b=self.b[self.p:self.p+n];self.p+=n;return b
    def byte(self):return self.take(1)[0]
    def num(self):
        t=self.byte()
        if t<192:return t
        if 192<=t<=199:return -int.from_bytes(self.take(t-191),'big')
        if 200<=t<=207:return int.from_bytes(self.take(t-199),'big')
        if t==208:return -(1<<63)
        raise ValueError(f'Invalid packed token {t:x} at {self.p-1}')
    def string(self):return self.take(self.num()).decode('utf-8',errors='replace')
    def typ(self):
        t=self.byte()
        if t in (5,9,15):return (t,int.from_bytes(self.take(8),'little'))
        if t==7:return (t,self.typ())
        if t==8:return (t,self.typ(),self.typ())
        return (t,)
class GOM:
    def __init__(self,root,reader=None):
        self.root=Path(root);self.fields={};self.enums={};self.nodes={};self.names={}
        read=reader or (lambda name:(self.root/name).read_bytes())
        for b in blocks(read('systemgenerated/client.gom')):self.definition(b)
        for file in sorted((self.root/'systemgenerated/buckets').glob('*.bkt')):
            b=read(file.relative_to(self.root).as_posix());assert b[:4]==b'PBUK';p=8
            for _ in range(2):
                n=u32(b,p);p+=4
                for record in blocks(b[p:p+n]):self.definition(record)
                p+=n
    def definition(self,b):
        kind=(u16(b,16)>>3)&15;ident=u64(b,8);name=cstr(b,u16(b,20))
        if kind==3:self.fields[ident]=(name or str(ident),Stream(b,u16(b,28)).typ())
        elif kind==2:self.enums[ident]=[cstr(b,u16(b,u16(b,26)+i*2)) for i in range(u16(b,24))]
        elif kind==1:self.nodes[ident]=(name,b);self.names[name]=ident
    def decode(self,ident):
        name,b=self.nodes[ident]
        if u16(b,16)&1:
            off=u16(b,18);b=b[:off]+(zstd.decompress(b[off:]) if b[off:off+4]==bytes.fromhex('28b52ffd') else zlib.decompress(b[off:]))
        length=u32(b,40);off=u16(b,44);style=b[48]
        if not length:return {}
        s=Stream(b[off:off+length]);s.style=style
        result=self.value(s,(9,))
        if s.p!=len(s.b):raise ValueError(f'{name}: trailing bytes {len(s.b)-s.p}')
        return result
    def count(self,s):
        n=s.num()
        return s.num() if s.style in (1,2,3,4,5,6) else n
    def value(self,s,typ):
        t=typ[0];typed=s.style in (1,2,3,4,5,9,10)
        if t in (1,2,14,15,17,20,21):return s.num()
        if t==3:return bool(s.byte())
        if t==4:return struct.unpack('<f',s.take(4))[0]
        if t==5:
            n=s.num();values=self.enums.get(typ[1] if len(typ)>1 else 0,[])
            return values[n-1] if 0<n<=len(values) else n
        if t==6:return s.string()
        if t==18:return list(struct.unpack('<fff',s.take(12)))
        if t==9:
            count=self.count(s);out={};field=0
            for _ in range(count):
                field=(field+s.num())&((1<<64)-1);wire=s.num() if typed else 0
                name,ft=self.fields.get(field,(str(field),(wire,)))
                out[name]=self.value(s,ft)
            return out
        if t==7:
            wire=s.num() if typed else 0;vt=typ[1] if len(typ)>1 else (wire,);count=self.count(s);out=[]
            if s.style==10:count>>=1
            for _ in range(count):
                if s.style in (1,2,3,4,7,8,9,10):s.num()
                out.append(self.value(s,vt))
            return out
        if t==8:
            kt=(s.num(),) if typed else typ[1];vt=(s.num(),) if typed else typ[2]
            if len(typ)>2:kt,vt=typ[1:]
            count=self.count(s);out={}
            if s.style==10:count>>=1
            for _ in range(count):
                if s.b[s.p]==210:s.byte();key=s.string()
                else:key=s.num()
                if kt[0]==5:
                    values=self.enums.get(kt[1],[])
                    if isinstance(key,int) and 0<key<=len(values):key=values[key-1]
                out[str(key)]=self.value(s,vt)
            return out
        if t==0:return None
        raise ValueError(f'Unsupported GOM type {typ} at {s.p}')

if __name__=='__main__':
    import json,collections
    g=GOM('G:/Old Republic Assets/resources');print('definitions',len(g.fields),'nodes',len(g.nodes))
    for prefix in ['npc.','npp.']:print(prefix,sum(n.startswith(prefix) for n in g.names))
    for name in [n for n in g.names if ('havoc_jorgan' in n or 'event.pirate_onslaught.event_off.republic.farmer_01' in n)]:
        print(name,json.dumps(g.decode(g.names[name]),indent=2))
