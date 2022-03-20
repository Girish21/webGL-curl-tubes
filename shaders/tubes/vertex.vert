varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec3 vWorldCoord;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);

  vUv = uv;
  vPosition = position;
  vNormal = normal;
  vWorldCoord = (modelMatrix * vec4(position, 1.)).xyz;
}
