import {useCurrentFrame, AbsoluteFill} from 'remotion';

export const Smoke: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{background: '#111', color: '#fff', fontSize: 64,
      alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif'}}>
      frame {frame}
    </AbsoluteFill>
  );
};
