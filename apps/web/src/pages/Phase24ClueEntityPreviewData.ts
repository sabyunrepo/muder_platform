export interface CluePreviewRow {
  id: string;
  name: string;
  status: 'selected' | 'used' | 'unused' | 'combo';
  usage: string;
  usageCount: number;
  tags: string[];
}


export interface ClueSelectOption {
  id: string;
  name: string;
  meta: string;
  tags: string[];
  locked?: boolean;
}

export const clueSelectOptions: ClueSelectOption[] = [
  { id: 'diary', name: '검은 잉크 일기장', meta: '핵심 단서 · 서재', tags: ['핵심', '일기장', '서재'] },
  { id: 'knife', name: '피 묻은 칼', meta: '물증 · 김철수 시작 단서', tags: ['물증', '칼', '시작 단서'] },
  { id: 'letter', name: '찢어진 편지', meta: '라운드2 공개', tags: ['편지', '라운드2'] },
  { id: 'box-letter', name: '상자 안 편지', meta: '잠긴 상자 보상', tags: ['상자', '편지', '보상'], locked: true },
  { id: 'basement-photo', name: '지하실 문 안쪽 사진', meta: '일회용 열쇠 보상', tags: ['지하실', '사진'], locked: true },
  { id: 'truth', name: '진실의 증거', meta: '조합 결과 단서', tags: ['조합', '결말'] },
  { id: 'safe-code', name: '금고 비밀번호 조각', meta: '퍼즐 정보', tags: ['금고', '비밀번호', '퍼즐'] },
  { id: 'receipt', name: '새벽 영수증', meta: '알리바이 반박', tags: ['영수증', '알리바이'] },
];

export const clueRows: CluePreviewRow[] = [
  {
    id: 'diary',
    name: '검은 잉크 일기장',
    status: 'selected',
    usage: '서재 · 김철수 · 진실의 증거 조합 재료',
    usageCount: 3,
    tags: ['핵심', '스포일러'],
  },
  {
    id: 'letter',
    name: '찢어진 편지',
    status: 'used',
    usage: '라운드2 공개 · 일기장 선행 단서',
    usageCount: 2,
    tags: ['라운드2'],
  },
  {
    id: 'knife',
    name: '피 묻은 칼',
    status: 'used',
    usage: '김철수 시작 단서',
    usageCount: 1,
    tags: ['물증'],
  },
  {
    id: 'cigarette',
    name: '담배꽁초',
    status: 'unused',
    usage: '미사용',
    usageCount: 0,
    tags: ['정리 필요'],
  },
  {
    id: 'truth',
    name: '진실의 증거',
    status: 'combo',
    usage: '일기장 + 칼 + 편지 조합 결과',
    usageCount: 3,
    tags: ['조합 결과'],
  },
];

export const backlinkRows = [
  { label: '서재', type: '장소', relation: '장소에서 발견할 수 있음' },
  { label: '김철수', type: '캐릭터', relation: '캐릭터 시작 단서로 지급됨' },
  { label: '진실의 증거', type: '단서', relation: '조합 조건에서 사용됨' },
];
