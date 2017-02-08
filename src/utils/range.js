export function remapNumberToRange( inputNumber, fromMin, fromMax, toMin, toMax ) {
  return (inputNumber - fromMin) / (fromMax - fromMin) * (toMax - toMin) + toMin;
}
