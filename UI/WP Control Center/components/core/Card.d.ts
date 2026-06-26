import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Header title text. */
  title?: React.ReactNode;
  /** Right-aligned actions (buttons, menu). */
  actions?: React.ReactNode;
}

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

/**
 * Surface container. Compose with CardHeader / CardBody.
 *
 * @startingPoint section="Core" subtitle="Card — header + body" viewport="700x180"
 */
export function Card(props: CardProps): JSX.Element;
export function CardHeader(props: CardHeaderProps): JSX.Element;
export function CardBody(props: CardBodyProps): JSX.Element;
