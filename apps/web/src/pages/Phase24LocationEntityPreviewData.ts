export const locationRows = [
  { id: 'estate', name: '별장', depth: 0, count: 5, status: 'root' },
  { id: 'floor-1', name: '1층', depth: 1, count: 3, status: 'group' },
  { id: 'study', name: '서재', depth: 2, count: 4, status: 'selected' },
  { id: 'kitchen', name: '부엌', depth: 2, count: 2, status: 'normal' },
  { id: 'floor-2', name: '2층', depth: 1, count: 1, status: 'warning' },
];

export const restrictedCharacters = [
  { name: '홍길동', role: '탐정', checked: false },
  { name: '김철수', role: '상속자', checked: true },
  { name: '이영희', role: '비서', checked: true },
];

export const allLocationClues = [
  { id: 'knife', name: '피 묻은 칼', location: '서재', round: 2, tag: 'location_clue' },
  { id: 'receipt', name: '찢어진 영수증', location: '서재', round: 1, tag: 'evidence' },
  { id: 'safe-code', name: '비밀 금고 암호', location: '서재', round: 3, tag: 'conditional_clue' },
  { id: 'ash', name: '담배꽁초', location: '정원', round: 1, tag: '미사용 후보' },
  { id: 'letter', name: '비밀 편지', location: '침실', round: 2, tag: 'character_clue' },
];
