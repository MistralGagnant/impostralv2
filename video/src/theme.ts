import {loadFont as loadPixel} from '@remotion/google-fonts/PressStart2P';
import {loadFont as loadTerm} from '@remotion/google-fonts/VT323';

const pixel = loadPixel();
const term = loadTerm();

// palette sombre + orange mistral, tiree du wordmark
export const theme = {
  bg: '#0A0A10',
  bg2: '#12121C',
  card: '#15151F',
  cardBorder: '#2A2A3A',
  ink: '#F2EFEA',
  dim: '#7E7E92',
  orange: '#FF8205',
  orangeHot: '#FF4D00',
  gold: '#FFAF00',
  red: '#FF2D3E',
  green: '#3DDC84',
};

export const fonts = {
  pixel: pixel.fontFamily,
  term: term.fontFamily,
};

export const FPS = 30;

export const PLAYERS = [
  {name: 'PLAYER 01', avatar: 'avatars/cat0.png', role: 'HUMAN'},
  {name: 'PLAYER 02', avatar: 'avatars/cat1.png', role: 'MISTRAL AGENT'},
  {name: 'PLAYER 03', avatar: 'avatars/cat2.png', role: 'MISTRAL AGENT'},
  {name: 'PLAYER 04', avatar: 'avatars/cat3.png', role: 'HUMAN'},
  {name: 'PLAYER 05', avatar: 'avatars/cat5.png', role: 'MISTRAL AGENT'},
  {name: 'PLAYER 06', avatar: 'avatars/cat7.png', role: 'MISTRAL AGENT'},
] as const;
