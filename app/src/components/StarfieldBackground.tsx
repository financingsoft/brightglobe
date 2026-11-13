import { useWindowDimensions, View, StyleSheet } from "react-native";

const STAR_FIELD = [[3,5,1.5,0.55],[9,14,1,0.42],[17,7,2,0.65],[24,20,1,0.48],[31,5,1.5,0.5],[39,13,1,0.42],[46,4,1,0.58],[54,18,2,0.6],[63,8,1,0.42],[72,15,1.5,0.55],[81,5,1,0.45],[91,12,1.5,0.52],[6,27,1,0.4],[14,36,1.5,0.52],[22,29,1,0.4],[29,42,2,0.64],[37,31,1,0.48],[44,39,1.5,0.55],[52,28,1,0.4],[60,43,1.5,0.52],[69,34,1,0.43],[77,25,2,0.62],[86,39,1,0.42],[95,30,1,0.52],[2,51,1,0.42],[11,60,2,0.6],[19,50,1,0.4],[27,62,1.5,0.55],[35,54,1,0.42],[43,67,1,0.52],[50,57,1,0.4],[58,66,2,0.64],[66,53,1,0.42],[74,63,1.5,0.55],[83,52,1,0.42],[92,65,1,0.5],[5,77,1.5,0.52],[13,87,1,0.43],[21,74,1,0.55],[30,91,1.5,0.58],[38,79,1,0.42],[47,88,1,0.5],[55,76,1,0.42],[64,91,1.5,0.6],[72,80,1,0.4],[80,93,1,0.55],[89,77,1,0.42],[97,88,1,0.5],[5,95,1,0.4],[18,96,1,0.35],[33,97,1,0.42],[48,96,1,0.4],[61,98,1,0.42],[76,97,1,0.4],[90,96,1,0.42]] as const;

/**
 * Lightweight static star field shared by every route.
 * The Earth scene keeps its own animated stars; this layer fills the rest of the app.
 */
export function StarfieldBackground() {
  const { width, height } = useWindowDimensions();
  const glowSize = Math.min(width * 0.95, 520);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      <View style={styles.spaceBase} />
      <View
        style={[
          styles.nebula,
          styles.nebulaViolet,
          {
            width: glowSize,
            height: glowSize,
            left: -glowSize * 0.42,
            top: height * 0.08
          }
        ]}
      />
      <View
        style={[
          styles.nebula,
          styles.nebulaBlue,
          {
            width: glowSize * 0.82,
            height: glowSize * 0.82,
            right: -glowSize * 0.35,
            top: height * 0.38
          }
        ]}
      />
      <View
        style={[
          styles.nebula,
          styles.nebulaIndigo,
          {
            width: glowSize * 0.72,
            height: glowSize * 0.72,
            left: width * 0.17,
            bottom: -glowSize * 0.34
          }
        ]}
      />
      <View style={styles.horizonGlow} />
      {STAR_FIELD.map(([x, y, size, opacity], index) => (
        <View
          key={index}
          style={[
            styles.star,
            {
              left: `${x}%`,
              top: `${y}%`,
              width: size,
              height: size,
              opacity
            },
            size > 1.5 && styles.brightStar
          ]}
        />
      ))}
      <View style={styles.distantCrossOne} />
      <View style={styles.distantCrossTwo} />
    </View>
  );
}

const styles = StyleSheet.create({
  spaceBase: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#030817"
  },
  nebula: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.22
  },
  nebulaViolet: {
    backgroundColor: "#40205F",
    shadowColor: "#9A55E8",
    shadowOpacity: 0.5,
    shadowRadius: 72,
    elevation: 0
  },
  nebulaBlue: {
    backgroundColor: "#103B68",
    shadowColor: "#2789DA",
    shadowOpacity: 0.52,
    shadowRadius: 74,
    elevation: 0
  },
  nebulaIndigo: {
    backgroundColor: "#24245D",
    shadowColor: "#6259D6",
    shadowOpacity: 0.48,
    shadowRadius: 78,
    elevation: 0
  },
  horizonGlow: {
    position: "absolute",
    left: "8%",
    right: "8%",
    top: "47%",
    height: 1,
    backgroundColor: "rgba(103, 158, 232, 0.12)"
  },
  star: {
    position: "absolute",
    borderRadius: 99,
    backgroundColor: "#DCEBFF"
  },
  brightStar: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#9CCBFF",
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 0
  },
  distantCrossOne: {
    position: "absolute",
    left: "17%",
    top: "18%",
    width: 13,
    height: 1,
    backgroundColor: "rgba(190, 216, 255, 0.28)",
    transform: [{ rotate: "-34deg" }]
  },
  distantCrossTwo: {
    position: "absolute",
    right: "13%",
    top: "73%",
    width: 10,
    height: 1,
    backgroundColor: "rgba(190, 216, 255, 0.22)",
    transform: [{ rotate: "28deg" }]
  }
});
